<?php

namespace Tests\Feature;

use App\Models\ActivationCode;
use App\Models\Store;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_admin_cannot_access_admin_endpoints(): void
    {
        $user = User::factory()->create(['is_admin' => false]);

        $response = $this->actingAs($user)->getJson('/api/admin/stats');

        $response->assertStatus(403);
        $response->assertJson([
            'success' => false,
        ]);
    }

    public function test_admin_can_view_platform_stats(): void
    {
        $admin = User::factory()->create([
            'is_admin' => true,
            'email' => 'admin@kashat.app',
        ]);

        $merchant = User::factory()->create(['is_admin' => false]);
        ActivationCode::create([
            'code' => 'KASH-TEST-0001-CODE',
            'duration_days' => 365,
            'plan' => 'BASIC',
            'is_used' => true,
            'used_by_user_id' => $merchant->id,
            'used_at' => now(),
        ]);

        $response = $this->actingAs($admin)->getJson('/api/admin/stats');

        $response->assertOk();
        $response->assertJsonStructure([
            'success',
            'data' => [
                'users' => ['total', 'merchants', 'admins'],
                'subscriptions' => ['active', 'expired', 'trial', 'paid'],
                'licenses' => ['total', 'unused', 'used'],
                'activity' => ['invoices', 'products', 'parties'],
                'financials' => ['estimated_revenue_egp'],
            ],
        ]);

        $expectedRevenue = 1 * (float) config('pos.annual_subscription_price', 500);
        $this->assertEquals($expectedRevenue, $response->json('data.financials.estimated_revenue_egp'));
    }

    public function test_admin_can_generate_and_filter_licenses(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $generateResponse = $this->actingAs($admin)->postJson('/api/admin/licenses/generate', [
            'count' => 5,
            'duration_days' => 365,
            'plan' => 'ANNUAL',
            'notes' => 'Test Batch',
        ]);

        $generateResponse->assertStatus(201);
        $this->assertCount(5, $generateResponse->json('data'));
        $this->assertDatabaseCount('activation_codes', 5);

        // List unused
        $listResponse = $this->actingAs($admin)->getJson('/api/admin/licenses?status=unused');
        $listResponse->assertOk();
        $this->assertCount(5, $listResponse->json('data.data'));
    }

    public function test_admin_can_list_users_and_extend_subscription(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $merchant = User::factory()->create(['name' => 'تاجر تجريبي']);

        Subscription::create([
            'user_id' => $merchant->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(10)->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'TRIAL',
            'price' => 0.00,
        ]);

        // List users
        $usersResponse = $this->actingAs($admin)->getJson('/api/admin/users?search=تجريبي');
        $usersResponse->assertOk();
        $this->assertCount(1, $usersResponse->json('data.data'));

        // Extend user
        $extendResponse = $this->actingAs($admin)->postJson("/api/admin/users/{$merchant->id}/extend", [
            'days' => 30,
            'notes' => 'هدية تمديد تجريبي',
        ]);

        $extendResponse->assertOk();
        $expectedEndDate = now()->addDays(40)->toDateString();
        $this->assertStringStartsWith($expectedEndDate, $extendResponse->json('data.end_date'));
    }

    public function test_employees_are_excluded_from_admin_merchants_list(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $merchant = User::factory()->create(['name' => 'صاحب المتجر', 'owner_id' => null]);
        $employee = User::factory()->create(['name' => 'مندوب نادر', 'owner_id' => $merchant->id]);

        $response = $this->actingAs($admin)->getJson('/api/admin/users');
        $response->assertOk();

        $ids = collect($response->json('data.data'))->pluck('id')->all();
        $this->assertContains($merchant->id, $ids);
        $this->assertNotContains($employee->id, $ids);
    }

    public function test_non_owner_employee_cannot_redeem_activation_code(): void
    {
        $merchant = User::factory()->create(['owner_id' => null]);
        $employee = User::factory()->create(['owner_id' => $merchant->id]);

        $code = ActivationCode::create([
            'code' => 'KASH-TEST-REDEEM-CODE',
            'duration_days' => 365,
            'plan' => 'ANNUAL',
            'is_used' => false,
        ]);

        $response = $this->actingAs($employee)->postJson('/api/subscription/activate-code', [
            'code' => 'KASH-TEST-REDEEM-CODE',
        ]);

        $response->assertStatus(422);
        $this->assertFalse($code->fresh()->is_used);
    }

    public function test_admin_can_revoke_unused_activation_code_and_cannot_be_redeemed(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $merchant = User::factory()->create(['owner_id' => null]);

        $code = ActivationCode::create([
            'code' => 'KASH-TO-BE-REVOKED',
            'duration_days' => 365,
            'plan' => 'ANNUAL',
            'is_used' => false,
        ]);

        // Revoke
        $revokeResponse = $this->actingAs($admin)->postJson("/api/admin/licenses/{$code->id}/revoke");
        $revokeResponse->assertOk();
        $this->assertTrue($code->fresh()->is_revoked);
        $this->assertNotNull($code->fresh()->revoked_at);

        // Try to redeem
        $redeemResponse = $this->actingAs($merchant)->postJson('/api/subscription/activate-code', [
            'code' => 'KASH-TO-BE-REVOKED',
        ]);
        $redeemResponse->assertStatus(422);
    }

    public function test_admin_cannot_revoke_already_used_code(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $merchant = User::factory()->create(['owner_id' => null]);

        $code = ActivationCode::create([
            'code' => 'KASH-ALREADY-USED',
            'duration_days' => 365,
            'plan' => 'ANNUAL',
            'is_used' => true,
            'used_by_user_id' => $merchant->id,
            'used_at' => now(),
        ]);

        $response = $this->actingAs($admin)->postJson("/api/admin/licenses/{$code->id}/revoke");
        $response->assertStatus(422);
    }

    public function test_admin_can_toggle_merchant_status_and_freeze_store(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $merchant = User::factory()->create(['owner_id' => null, 'status' => 'ACTIVE']);
        $employee = User::factory()->create(['owner_id' => $merchant->id, 'status' => 'ACTIVE']);

        Subscription::create([
            'user_id' => $merchant->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(30)->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'ANNUAL',
            'price' => 500.00,
        ]);

        // Toggle to INACTIVE
        $toggleResponse = $this->actingAs($admin)->postJson("/api/admin/users/{$merchant->id}/toggle-status");
        $toggleResponse->assertOk();
        $this->assertEquals('INACTIVE', $merchant->fresh()->status->value);

        // Merchant should be blocked by CheckSubscription middleware
        $merchantReq = $this->actingAs($merchant->fresh())->getJson('/api/invoices');
        $merchantReq->assertStatus(403);

        // Employee should also be blocked because store is suspended
        $employeeReq = $this->actingAs($employee->fresh())->getJson('/api/invoices');
        $employeeReq->assertStatus(403);
    }

    public function test_root_super_admin_cannot_be_suspended(): void
    {
        $admin = User::factory()->create([
            'email' => 'ahmadhasandev711@gmail.com',
            'is_admin' => true,
        ]);

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$admin->id}/toggle-status");
        $response->assertStatus(422);
    }

    public function test_admin_can_view_store_staff_and_branches(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $merchant = User::factory()->create(['owner_id' => null]);
        User::factory()->create(['name' => 'كاشير أحمد', 'owner_id' => $merchant->id]);

        $response = $this->actingAs($admin)->getJson("/api/admin/users/{$merchant->id}/staff");
        $response->assertOk();
        $this->assertCount(1, $response->json('data.employees'));
    }
}
