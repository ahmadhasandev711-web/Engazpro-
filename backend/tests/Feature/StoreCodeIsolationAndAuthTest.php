<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Mail\OwnerPasswordOtpMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class StoreCodeIsolationAndAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_register_multiple_stores_with_same_phone_and_email_using_different_store_codes(): void
    {
        $first = $this->postJson('/api/auth/register', [
            'store_code' => 'TIA',
            'name' => 'تيا فاشون 1',
            'phone' => '+201012345678',
            'email' => 'Owner@Tia.com',
            'password' => 'secret123',
        ])->assertStatus(201);

        $first->assertJsonPath('data.user.store_code', 'tia');
        $firstId = $first->json('data.user.id');

        $second = $this->postJson('/api/auth/register', [
            'store_code' => 'tia-2',
            'name' => 'تيا فاشون 2',
            'phone' => '01012345678',
            'email' => 'owner@tia.com',
            'password' => 'secret456',
        ])->assertStatus(201);

        $second->assertJsonPath('data.user.store_code', 'tia-2');
        $secondId = $second->json('data.user.id');
        $this->assertNotSame($firstId, $secondId);

        $this->postJson('/api/auth/login', [
            'store_code' => 'tia',
            'phone' => '01012345678',
            'password' => 'secret123',
        ])->assertOk()->assertJsonPath('data.user.id', $firstId);

        $this->postJson('/api/auth/login', [
            'store_code' => 'tia-2',
            'phone' => '01012345678',
            'password' => 'secret456',
        ])->assertOk()->assertJsonPath('data.user.id', $secondId);
    }

    public function test_reserved_and_duplicate_store_codes_are_rejected_on_registration(): void
    {
        $this->postJson('/api/auth/register', [
            'store_code' => 'easyfy',
            'name' => 'محاولة سرقة كود الأدمن',
            'phone' => '01011112222',
            'email' => 'fake@example.com',
            'password' => 'secret123',
        ])->assertStatus(422)->assertJsonValidationErrors(['store_code']);

        $this->postJson('/api/auth/register', [
            'store_code' => 'admin',
            'name' => 'محاولة كلمة محجوزة',
            'phone' => '01011113333',
            'email' => 'fake2@example.com',
            'password' => 'secret123',
        ])->assertStatus(422)->assertJsonValidationErrors(['store_code']);

        $this->postJson('/api/auth/register', [
            'store_code' => 'عربي هنا',
            'name' => 'صيغة غير صالحة',
            'phone' => '01011114444',
            'email' => 'fake3@example.com',
            'password' => 'secret123',
        ])->assertStatus(422)->assertJsonValidationErrors(['store_code']);

        $this->postJson('/api/auth/register', [
            'store_code' => 'unique-shop',
            'name' => 'متجر أصلي',
            'phone' => '01011115555',
            'email' => 'shop1@example.com',
            'password' => 'secret123',
        ])->assertStatus(201);

        $this->postJson('/api/auth/register', [
            'store_code' => 'unique-shop',
            'name' => 'متجر مكرر',
            'phone' => '01099998888',
            'email' => 'shop2@example.com',
            'password' => 'secret123',
        ])->assertStatus(422)->assertJsonValidationErrors(['store_code']);
    }

    public function test_same_phone_can_work_as_cashier_in_two_stores_but_not_duplicated_inside_same_store(): void
    {
        $storeARes = $this->postJson('/api/auth/register', [
            'store_code' => 'store-a',
            'name' => 'متجر أ',
            'phone' => '01010000001',
            'email' => 'a@example.com',
            'password' => 'secret123',
        ])->assertStatus(201);
        $ownerA = User::findOrFail($storeARes->json('data.user.id'));

        $storeBRes = $this->postJson('/api/auth/register', [
            'store_code' => 'store-b',
            'name' => 'متجر ب',
            'phone' => '01010000002',
            'email' => 'b@example.com',
            'password' => 'secret123',
        ])->assertStatus(201);
        $ownerB = User::findOrFail($storeBRes->json('data.user.id'));

        $branchA = $ownerA->branches()->firstOrFail();
        $branchB = $ownerB->branches()->firstOrFail();

        $this->actingAs($ownerA)->postJson('/api/employees', [
            'name' => 'كاشير مشترك',
            'phone' => '01055554444',
            'email' => 'cashier@shared.com',
            'password' => 'passA123',
            'role' => UserRole::CASHIER->value,
            'branch_id' => $branchA->id,
        ])->assertStatus(201);

        $this->actingAs($ownerB)->postJson('/api/employees', [
            'name' => 'كاشير في المحل الثاني',
            'phone' => '01055554444',
            'email' => 'cashier@shared.com',
            'password' => 'passB123',
            'role' => UserRole::CASHIER->value,
            'branch_id' => $branchB->id,
        ])->assertStatus(201);

        $this->actingAs($ownerA)->postJson('/api/employees', [
            'name' => 'تكرار داخل نفس المتجر بصيغة +20',
            'phone' => '+201055554444',
            'password' => 'passDup123',
            'role' => UserRole::CASHIER->value,
            'branch_id' => $branchA->id,
        ])->assertStatus(422)->assertJsonValidationErrors(['phone']);

        $this->actingAs($ownerA)->postJson('/api/employees', [
            'name' => 'تكرار رقم الأونر نفسه داخل متجره',
            'phone' => '01010000001',
            'password' => 'passOwnerDup',
            'role' => UserRole::CASHIER->value,
            'branch_id' => $branchA->id,
        ])->assertStatus(422)->assertJsonValidationErrors(['phone']);

        $this->postJson('/api/auth/login', [
            'store_code' => 'store-a',
            'phone' => '01055554444',
            'password' => 'passA123',
        ])->assertOk()->assertJsonPath('data.user.owner_id', $ownerA->id);

        $this->postJson('/api/auth/login', [
            'store_code' => 'store-b',
            'phone' => '01055554444',
            'password' => 'passB123',
        ])->assertOk()->assertJsonPath('data.user.owner_id', $ownerB->id);
    }

    public function test_easyfy_code_allows_only_super_admin_login_and_password_recovery_is_store_scoped(): void
    {
        Mail::fake();

        $admin = User::factory()->create([
            'is_admin' => true,
            'role' => UserRole::ADMIN,
            'phone' => '01088887777',
            'email' => 'admin@easyfy.cloud',
            'password' => Hash::make('adminpass123'),
        ]);

        $this->postJson('/api/auth/register', [
            'store_code' => 'alpha',
            'name' => 'تاجر ألفا',
            'phone' => '01077776666',
            'email' => 'alpha@example.com',
            'password' => 'alphaPass',
        ])->assertStatus(201);

        $this->postJson('/api/auth/register', [
            'store_code' => 'beta',
            'name' => 'تاجر بيتا',
            'phone' => '01077776666',
            'email' => 'beta@example.com',
            'password' => 'betaPass',
        ])->assertStatus(201);

        $this->postJson('/api/auth/login', [
            'store_code' => 'easyfy',
            'phone' => '01077776666',
            'password' => 'alphaPass',
        ])->assertStatus(422);

        $this->postJson('/api/auth/login', [
            'store_code' => 'easyfy',
            'phone' => '01088887777',
            'password' => 'adminpass123',
        ])->assertOk()->assertJsonPath('data.user.id', $admin->id)->assertJsonPath('data.user.is_admin', true);

        $this->postJson('/api/auth/forgot-password', [
            'store_code' => 'beta',
            'phone' => '01077776666',
        ])->assertOk()->assertJsonPath('data.mode', 'OTP_EMAIL');

        Mail::assertSent(OwnerPasswordOtpMail::class, fn (OwnerPasswordOtpMail $m) => $m->hasTo('beta@example.com'));
        Mail::assertNotSent(OwnerPasswordOtpMail::class, fn (OwnerPasswordOtpMail $m) => $m->hasTo('alpha@example.com'));
    }

    public function test_admin_updating_store_code_cascades_to_all_store_employees(): void
    {
        $admin = User::factory()->create(['is_admin' => true, 'role' => UserRole::ADMIN]);
        $reg = $this->postJson('/api/auth/register', [
            'store_code' => 'old-code',
            'name' => 'تاجر قديم',
            'phone' => '01033332222',
            'email' => 'old@example.com',
            'password' => 'pass1234',
        ])->assertStatus(201);
        $owner = User::findOrFail($reg->json('data.user.id'));
        $branch = $owner->branches()->firstOrFail();

        $this->actingAs($owner)->postJson('/api/employees', [
            'name' => 'موظف المتجر',
            'phone' => '01044443333',
            'password' => 'emp1234',
            'role' => UserRole::CASHIER->value,
            'branch_id' => $branch->id,
        ])->assertStatus(201);

        $this->actingAs($admin)->putJson("/api/admin/users/{$owner->id}/profile", [
            'store_code' => 'new-brand',
            'name' => 'تاجر محدث',
            'phone' => '01033332222',
            'email' => 'old@example.com',
        ])->assertOk();

        $this->postJson('/api/auth/login', [
            'store_code' => 'old-code',
            'phone' => '01044443333',
            'password' => 'emp1234',
        ])->assertStatus(422);

        $this->postJson('/api/auth/login', [
            'store_code' => 'new-brand',
            'phone' => '01044443333',
            'password' => 'emp1234',
        ])->assertOk()->assertJsonPath('data.user.store_code', 'new-brand');
    }
}
