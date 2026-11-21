<?php

namespace Tests\Feature;

use App\Contracts\WooCommerceApiClientInterface;
use App\Enums\AdminAuditAction;
use App\Enums\EcommercePlatform;
use App\Enums\PasswordResetRequestStatus;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Mail\OwnerPasswordOtpMail;
use App\Models\Branch;
use App\Models\PasswordResetOtp;
use App\Models\PasswordResetRequest;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AdminStoreControlAndRecoveryTest extends TestCase
{
    use RefreshDatabase;

    private function createMerchantWithBranch(bool $withEmail = true): array
    {
        $owner = User::factory()->create([
            'role' => UserRole::OWNER,
            'is_admin' => false,
            'ecommerce_enabled' => true,
            'email' => $withEmail ? 'owner.' . uniqid() . '@example.com' : null,
            'password' => Hash::make('oldpass123'),
        ]);
        Subscription::create([
            'user_id' => $owner->id,
            'start_date' => now()->subDay()->toDateString(),
            'end_date' => now()->addDays(14)->toDateString(),
            'status' => SubscriptionStatus::ACTIVE,
            'plan' => 'TRIAL',
            'price' => 0,
        ]);
        $branch = Branch::create([
            'user_id' => $owner->id,
            'name' => 'فرع المعادي',
            'code' => 'MAADI-' . $owner->id,
            'type' => 'STORE',
            'is_main' => true,
            'is_active' => true,
        ]);

        return [$owner, $branch];
    }

    public function test_owner_registration_requires_email_while_employee_creation_allows_null_email(): void
    {
        $this->postJson('/api/auth/register', [
            'store_code' => 'no-email-owner',
            'name' => 'أونر بدون إيميل',
            'phone' => '01011223344',
            'password' => 'secret123',
        ])->assertStatus(422)->assertJsonValidationErrors(['email']);

        [$owner, $branch] = $this->createMerchantWithBranch();
        $this->actingAs($owner)->postJson('/api/employees', [
            'name' => 'كاشير بدون إيميل',
            'phone' => '01099887711',
            'email' => null,
            'password' => 'cashier123',
            'role' => UserRole::CASHIER->value,
            'branch_id' => $branch->id,
        ])->assertStatus(201);
    }

    public function test_owner_otp_password_recovery_sends_mail_resets_password_and_revokes_tokens(): void
    {
        Mail::fake();
        [$owner] = $this->createMerchantWithBranch(true);
        $oldToken = $owner->createToken('web')->plainTextToken;

        $this->postJson('/api/auth/forgot-password', ['store_code' => $owner->store_code, 'phone' => $owner->phone])
            ->assertOk()
            ->assertJsonPath('data.mode', 'OTP_EMAIL');

        $sentCode = null;
        Mail::assertSent(OwnerPasswordOtpMail::class, function (OwnerPasswordOtpMail $mail) use (&$sentCode, $owner) {
            $sentCode = $mail->otpCode;
            return $mail->hasTo((string) $owner->email);
        });
        $this->assertNotNull($sentCode);

        $this->postJson('/api/auth/reset-password-otp', [
            'store_code' => $owner->store_code,
            'phone' => $owner->phone,
            'otp' => '000000',
            'password' => 'newpass123',
        ])->assertStatus(422);

        $this->assertSame(1, PasswordResetOtp::where('user_id', $owner->id)->firstOrFail()->attempts);

        $this->postJson('/api/auth/reset-password-otp', [
            'store_code' => $owner->store_code,
            'phone' => $owner->phone,
            'otp' => $sentCode,
            'password' => 'newpass123',
        ])->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $owner->id]);
        $this->postJson('/api/auth/login', ['store_code' => $owner->store_code, 'phone' => $owner->phone, 'password' => 'newpass123'])->assertOk();
    }

    public function test_staff_and_email_less_owner_reset_requests_and_employee_token_revocation(): void
    {
        [$owner, $branch] = $this->createMerchantWithBranch(false);
        $cashier = User::factory()->create([
            'owner_id' => $owner->id,
            'role' => UserRole::CASHIER,
            'branch_id' => $branch->id,
            'phone' => '01055566677',
            'email' => null,
            'password' => Hash::make('oldcashier'),
        ]);
        $cashier->createToken('pos')->plainTextToken;

        $this->postJson('/api/auth/forgot-password', ['store_code' => $owner->store_code, 'phone' => $cashier->phone])
            ->assertOk()
            ->assertJsonPath('data.mode', 'STAFF_REQUEST');

        $this->actingAs($owner)->getJson('/api/employees/reset-requests')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAs($owner)->putJson("/api/employees/{$cashier->id}", [
            'name' => $cashier->name,
            'phone' => $cashier->phone,
            'role' => UserRole::CASHIER->value,
            'branch_id' => $branch->id,
            'password' => 'newcashier123',
        ])->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $cashier->id]);
        $this->assertSame(PasswordResetRequestStatus::RESOLVED, PasswordResetRequest::where('user_id', $cashier->id)->firstOrFail()->status);

        $admin = User::factory()->create(['is_admin' => true, 'role' => UserRole::ADMIN]);
        $this->postJson('/api/auth/forgot-password', ['store_code' => $owner->store_code, 'phone' => $owner->phone])
            ->assertOk()
            ->assertJsonPath('data.mode', 'OWNER_SUPPORT_REQUEST');

        $this->actingAs($admin)->getJson('/api/admin/password-reset-requests')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_super_admin_store_control_ecommerce_management_staff_and_impersonation(): void
    {
        $admin = User::factory()->create(['is_admin' => true, 'role' => UserRole::ADMIN]);
        [$owner, $branch] = $this->createMerchantWithBranch();
        $staff = User::factory()->create([
            'owner_id' => $owner->id,
            'role' => UserRole::MANAGER,
            'branch_id' => $branch->id,
        ]);

        // Update merchant profile & plan
        $this->actingAs($admin)->putJson("/api/admin/users/{$owner->id}/profile", [
            'name' => 'أحمد المحدّث',
            'business_name' => 'براند المحدّث',
            'phone' => $owner->phone,
            'email' => $owner->email,
            'plan' => 'PRO_ECOMMERCE',
        ])->assertOk();
        $this->assertSame('براند المحدّث', $owner->fresh(['settings', 'subscription'])->business_name);

        // Configure WooCommerce from Super Admin + Test + Remove
        $mockWc = $this->createMock(WooCommerceApiClientInterface::class);
        $mockWc->method('testConnection')->willReturn(true);
        $this->app->instance(WooCommerceApiClientInterface::class, $mockWc);

        $this->actingAs($admin)->putJson("/api/admin/users/{$owner->id}/ecommerce/woocommerce", [
            'store_url' => 'https://new-shop.example.com',
            'consumer_key' => 'ck_admin_set',
            'consumer_secret' => 'cs_admin_set',
            'online_branch_id' => $branch->id,
            'auto_sync_stock' => true,
            'auto_sync_prices' => true,
            'auto_sync_promotions' => true,
            'is_active' => true,
        ])->assertOk();

        $this->actingAs($admin)->postJson("/api/admin/users/{$owner->id}/ecommerce/test")->assertOk()->assertJsonPath('success', true);

        // Switch to Shopify from Super Admin -> automatically disables WooCommerce
        $this->actingAs($admin)->putJson("/api/admin/users/{$owner->id}/ecommerce/shopify", [
            'shop_domain' => 'demo-brand.myshopify.com',
            'access_token' => 'shpat_admin_123',
            'is_active' => true,
        ])->assertOk();
        $this->assertFalse((bool) WooCommerceIntegration::withoutGlobalScopes()->where('user_id', $owner->id)->firstOrFail()->is_active);

        $this->actingAs($admin)->deleteJson("/api/admin/users/{$owner->id}/ecommerce/" . EcommercePlatform::WOOCOMMERCE->value)->assertOk();

        // Impersonate merchant & forbid impersonating admin
        $impRes = $this->actingAs($admin)->postJson("/api/admin/users/{$owner->id}/impersonate")
            ->assertOk()
            ->assertJsonStructure(['data' => ['user', 'token', 'impersonated_by']]);
        $this->assertDatabaseHas('admin_audit_logs', [
            'target_user_id' => $owner->id,
            'action' => AdminAuditAction::STORE_IMPERSONATED->value,
        ]);
        $this->actingAs($admin)->postJson("/api/admin/users/{$admin->id}/impersonate")->assertStatus(422);

        // Admin controls merchant staff (reset password + toggle status)
        $this->actingAs($admin)->postJson("/api/admin/users/{$owner->id}/staff/{$staff->id}/reset-password", [
            'password' => 'staffpass99',
        ])->assertOk();
        $this->assertTrue(Hash::check('staffpass99', (string) $staff->fresh()->password));

        $this->actingAs($admin)->postJson("/api/admin/users/{$owner->id}/staff/{$staff->id}/toggle-status")
            ->assertOk();
        $this->assertSame(UserStatus::INACTIVE, $staff->fresh()->status);

        // Queue overview endpoint
        $this->actingAs($admin)->getJson('/api/admin/system/queue')
            ->assertOk()
            ->assertJsonStructure(['data' => ['pending_count', 'failed_count', 'failed_items']]);
    }
}
