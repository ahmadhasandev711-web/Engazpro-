<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminPasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_reset_merchant_password(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::OWNER->value,
            'is_admin' => true,
        ]);

        $merchant = User::factory()->create([
            'name' => 'تاجر تجريبي',
            'phone' => '01099998888',
            'password' => Hash::make('oldpassword'),
            'role' => UserRole::OWNER->value,
            'is_admin' => false,
        ]);

        Subscription::create([
            'user_id' => $merchant->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
        ]);

        // 1. Non-admin is forbidden
        $regularUser = User::factory()->create(['is_admin' => false]);
        $resForbidden = $this->actingAs($regularUser)->postJson("/api/admin/users/{$merchant->id}/reset-password", [
            'password' => 'newpassword123',
        ]);
        $resForbidden->assertForbidden();

        // 2. Short password fails
        $resShort = $this->actingAs($admin)->postJson("/api/admin/users/{$merchant->id}/reset-password", [
            'password' => '123',
        ]);
        $resShort->assertUnprocessable();

        // 3. Admin resets password successfully
        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$merchant->id}/reset-password", [
            'password' => 'NewSecret@2026',
        ]);
        $response->assertOk()
            ->assertJsonPath('success', true);

        // 4. Merchant can login with new password
        $loginRes = $this->postJson('/api/auth/login', [
            'phone' => '01099998888',
            'password' => 'NewSecret@2026',
        ]);
        $loginRes->assertOk();

        // 5. Merchant can also login with Arabic numerals normalized
        $loginResArabic = $this->postJson('/api/auth/login', [
            'phone' => '٠١٠٩٩٩٩٨٨٨٨',
            'password' => 'NewSecret@2026',
        ]);
        $loginResArabic->assertOk();

        // 6. Login with accidental trailing space in password
        $loginResSpace = $this->postJson('/api/auth/login', [
            'phone' => '01099998888',
            'password' => 'NewSecret@2026 ',
        ]);
        $loginResSpace->assertOk();

        // 7. Login with +20 country code
        $loginResCountry = $this->postJson('/api/auth/login', [
            'phone' => '+201099998888',
            'password' => 'NewSecret@2026',
        ]);
        $loginResCountry->assertOk();
    }
}

