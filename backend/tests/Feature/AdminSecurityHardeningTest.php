<?php

namespace Tests\Feature;

use App\Enums\AdminAuditAction;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\ActivationCode;
use App\Models\AdminAuditLog;
use App\Models\Subscription;
use App\Models\User;
use App\Services\SubscriptionGate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class AdminSecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_audit_log_is_strictly_append_only_and_immutable(): void
    {
        $admin = User::factory()->create(['is_admin' => true, 'role' => UserRole::OWNER->value]);

        $log = AdminAuditLog::create([
            'actor_user_id' => $admin->id,
            'target_user_id' => null,
            'action' => AdminAuditAction::LICENSES_GENERATED->value,
            'summary' => 'توليد 5 أكواد تفعيل',
            'metadata' => ['count' => 5],
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
        ]);

        $this->expectException(\LogicException::class);
        $log->update(['summary' => 'محاولة تلاعب']);
    }

    public function test_admin_audit_log_throws_exception_on_delete_and_has_no_mutation_routes(): void
    {
        $admin = User::factory()->create(['is_admin' => true, 'role' => UserRole::OWNER->value]);

        $log = AdminAuditLog::create([
            'actor_user_id' => $admin->id,
            'action' => AdminAuditAction::USER_FROZEN->value,
            'summary' => 'تجميد متجر',
            'ip_address' => '127.0.0.1',
        ]);

        // No route should allow PUT/PATCH/DELETE on audit-logs
        $deleteRouteRes = $this->actingAs($admin)->deleteJson("/api/admin/audit-logs/{$log->id}");
        $this->assertContains($deleteRouteRes->getStatusCode(), [404, 405]);

        $patchRouteRes = $this->actingAs($admin)->patchJson("/api/admin/audit-logs/{$log->id}", ['summary' => 'hack']);
        $this->assertContains($patchRouteRes->getStatusCode(), [404, 405]);

        $this->expectException(\LogicException::class);
        $log->delete();
    }

    public function test_all_admin_accounts_are_protected_from_merchant_destructive_actions(): void
    {
        $actorAdmin = User::factory()->create(['is_admin' => true, 'email' => 'admin1@example.com']);
        $otherAdmin = User::factory()->create(['is_admin' => true, 'email' => 'other-admin@example.com']);

        $this->actingAs($actorAdmin)
            ->postJson("/api/admin/users/{$otherAdmin->id}/toggle-status")
            ->assertStatus(422);

        $this->actingAs($actorAdmin)
            ->postJson("/api/admin/users/{$otherAdmin->id}/reset-password", ['password' => 'StrongPass@123'])
            ->assertStatus(422);

        $this->actingAs($actorAdmin)
            ->postJson("/api/admin/users/{$otherAdmin->id}/revoke-subscription")
            ->assertStatus(422);

        $this->actingAs($actorAdmin)
            ->postJson("/api/admin/users/{$otherAdmin->id}/force-logout")
            ->assertStatus(422);
    }

    public function test_freezing_store_revokes_owner_and_employee_tokens_and_clears_subscription_gate(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $merchant = User::factory()->create(['owner_id' => null, 'status' => UserStatus::ACTIVE]);
        $employee = User::factory()->create([
            'owner_id' => $merchant->id,
            'status' => UserStatus::ACTIVE,
            'role' => UserRole::CASHIER->value,
        ]);

        Subscription::create([
            'user_id' => $merchant->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(30)->toDateString(),
            'status' => SubscriptionStatus::ACTIVE,
            'plan' => 'ANNUAL',
            'price' => 3000.00,
        ]);

        $merchantToken = $merchant->createToken('merchant-device')->plainTextToken;
        $employeeToken = $employee->createToken('employee-device')->plainTextToken;

        // Warm cache
        $warm = SubscriptionGate::statusFor($employee);
        $this->assertTrue($warm['active']);

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$merchant->id}/toggle-status")
            ->assertOk();

        $this->assertEquals(0, $merchant->tokens()->count());
        $this->assertEquals(0, $employee->tokens()->count());

        // SubscriptionGate cache cleared immediately
        $afterFreeze = SubscriptionGate::statusFor($employee->fresh());
        $this->assertFalse($afterFreeze['active']);
        $this->assertTrue($afterFreeze['frozen']);

        // Token auth must now fail
        $this->app['auth']->forgetGuards();
        $this->withToken($merchantToken)->getJson('/api/invoices')->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $this->withToken($employeeToken)->getJson('/api/invoices')->assertUnauthorized();

        // Audit log recorded
        $this->assertDatabaseHas('admin_audit_logs', [
            'actor_user_id' => $admin->id,
            'target_user_id' => $merchant->id,
            'action' => AdminAuditAction::USER_FROZEN->value,
        ]);
    }

    public function test_force_logout_store_revokes_all_sessions_without_freezing_account(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $merchant = User::factory()->create(['owner_id' => null, 'status' => UserStatus::ACTIVE]);
        $employee = User::factory()->create(['owner_id' => $merchant->id, 'status' => UserStatus::ACTIVE]);

        $merchant->createToken('pos-1');
        $employee->createToken('pos-2');

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$merchant->id}/force-logout")
            ->assertOk();

        $this->assertEquals(0, $merchant->tokens()->count());
        $this->assertEquals(0, $employee->tokens()->count());
        $this->assertEquals(UserStatus::ACTIVE, $merchant->fresh()->status);

        $this->assertDatabaseHas('admin_audit_logs', [
            'actor_user_id' => $admin->id,
            'target_user_id' => $merchant->id,
            'action' => AdminAuditAction::STORE_SESSIONS_REVOKED->value,
        ]);
    }

    public function test_revoke_subscription_cancels_with_enum_and_blocks_store_access(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $merchant = User::factory()->create(['owner_id' => null, 'status' => UserStatus::ACTIVE]);

        $sub = Subscription::create([
            'user_id' => $merchant->id,
            'start_date' => now()->subDays(10)->toDateString(),
            'end_date' => now()->addDays(60)->toDateString(),
            'status' => SubscriptionStatus::ACTIVE,
            'plan' => 'ANNUAL',
            'price' => 3000.00,
        ]);

        SubscriptionGate::statusFor($merchant);

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$merchant->id}/revoke-subscription", [
                'notes' => 'إلغاء مخالفة شروط',
            ])
            ->assertOk();

        $freshSub = $sub->fresh();
        $this->assertEquals(SubscriptionStatus::CANCELLED, $freshSub->status);
        $this->assertTrue($freshSub->end_date->isPast());

        $this->actingAs($merchant->fresh())
            ->getJson('/api/invoices')
            ->assertStatus(403);

        $this->assertDatabaseHas('admin_audit_logs', [
            'actor_user_id' => $admin->id,
            'target_user_id' => $merchant->id,
            'action' => AdminAuditAction::SUBSCRIPTION_REVOKED->value,
        ]);
    }

    public function test_ensure_user_is_admin_blocks_inactive_admin_and_disallowed_ips(): void
    {
        $inactiveAdmin = User::factory()->create([
            'is_admin' => true,
            'status' => UserStatus::INACTIVE,
        ]);

        $this->actingAs($inactiveAdmin)
            ->getJson('/api/admin/stats')
            ->assertStatus(403);

        $this->assertDatabaseHas('admin_audit_logs', [
            'actor_user_id' => $inactiveAdmin->id,
            'action' => AdminAuditAction::ADMIN_ACCESS_DENIED->value,
        ]);

        $activeAdmin = User::factory()->create([
            'is_admin' => true,
            'status' => UserStatus::ACTIVE,
        ]);

        Config::set('pos.admin.allowed_ips', ['10.10.10.10']);

        $this->actingAs($activeAdmin)
            ->withServerVariables(['REMOTE_ADDR' => '192.168.1.55'])
            ->getJson('/api/admin/stats')
            ->assertStatus(403);

        $this->actingAs($activeAdmin)
            ->withServerVariables(['REMOTE_ADDR' => '10.10.10.10'])
            ->getJson('/api/admin/stats')
            ->assertOk();
    }

    public function test_activation_rate_limit_and_partial_code_failure_logging(): void
    {
        Config::set('pos.security.activation_per_minute', 3);
        RateLimiter::clear('activation');

        $merchant = User::factory()->create(['owner_id' => null, 'status' => UserStatus::ACTIVE]);
        $fullSecretCode = 'WRONG-SECRET-9999-XYZ';

        // Attempts 1..3 fail validation (422) and log ONLY 4-char prefix
        for ($i = 0; $i < 3; $i++) {
            $this->actingAs($merchant)
                ->withServerVariables(['REMOTE_ADDR' => '10.20.30.40'])
                ->postJson('/api/subscription/activate-code', ['code' => $fullSecretCode])
                ->assertStatus(422);
        }

        // Attempt 4 triggers throttle:activation (429)
        $this->actingAs($merchant)
            ->withServerVariables(['REMOTE_ADDR' => '10.20.30.40'])
            ->postJson('/api/subscription/activate-code', ['code' => $fullSecretCode])
            ->assertStatus(429);

        $failLog = AdminAuditLog::where('action', AdminAuditAction::LICENSE_REDEEM_FAILED->value)->first();
        $this->assertNotNull($failLog);
        $this->assertEquals($merchant->id, $failLog->actor_user_id);
        $this->assertEquals('10.20.30.40', $failLog->ip_address);
        $this->assertEquals('WRON', $failLog->metadata['code_prefix'] ?? null);
        $this->assertStringNotContainsString('SECRET-9999', json_encode($failLog->metadata) . $failLog->summary);
    }

    public function test_stats_hides_database_name_and_unifies_money_pricing_and_filters_users(): void
    {
        Config::set('pos.annual_subscription_price', 3000.00);

        $admin = User::factory()->create(['is_admin' => true]);
        $activeMerchant = User::factory()->create(['owner_id' => null, 'status' => UserStatus::ACTIVE, 'name' => 'متجر نشط']);
        $frozenMerchant = User::factory()->create(['owner_id' => null, 'status' => UserStatus::INACTIVE, 'name' => 'متجر مجمد']);
        $expiredMerchant = User::factory()->create(['owner_id' => null, 'status' => UserStatus::ACTIVE, 'name' => 'متجر منتهي']);
        $trialMerchant = User::factory()->create(['owner_id' => null, 'status' => UserStatus::ACTIVE, 'name' => 'متجر تجريبي']);

        Subscription::create([
            'user_id' => $activeMerchant->id,
            'start_date' => now()->subDays(5)->toDateString(),
            'end_date' => now()->addDays(100)->toDateString(),
            'status' => SubscriptionStatus::ACTIVE,
            'plan' => 'ANNUAL',
            'price' => 3000.00,
        ]);

        Subscription::create([
            'user_id' => $expiredMerchant->id,
            'start_date' => now()->subDays(100)->toDateString(),
            'end_date' => now()->subDays(10)->toDateString(),
            'status' => SubscriptionStatus::EXPIRED,
            'plan' => 'ANNUAL',
            'price' => 0.00,
        ]);

        Subscription::create([
            'user_id' => $trialMerchant->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(14)->toDateString(),
            'status' => SubscriptionStatus::ACTIVE,
            'plan' => 'TRIAL',
            'price' => 0.00,
        ]);

        $statsRes = $this->actingAs($admin)->getJson('/api/admin/stats')->assertOk();
        $system = $statsRes->json('data.system');
        $this->assertArrayNotHasKey('database_name', $system);
        $this->assertEquals(3000.0, $statsRes->json('data.financials.recorded_revenue_egp'));

        // User status filters
        $frozenList = $this->actingAs($admin)->getJson('/api/admin/users?status=inactive')->assertOk();
        $this->assertContains($frozenMerchant->id, collect($frozenList->json('data.data'))->pluck('id')->all());

        $expiredList = $this->actingAs($admin)->getJson('/api/admin/users?status=expired')->assertOk();
        $this->assertContains($expiredMerchant->id, collect($expiredList->json('data.data'))->pluck('id')->all());

        $trialList = $this->actingAs($admin)->getJson('/api/admin/users?status=trial')->assertOk();
        $this->assertContains($trialMerchant->id, collect($trialList->json('data.data'))->pluck('id')->all());

        // Audit logs endpoint works
        $this->actingAs($admin)->getJson('/api/admin/audit-logs')->assertOk();
    }
}
