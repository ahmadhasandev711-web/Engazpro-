<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Models\Branch;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityHardeningWave1Test extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $mainBranch;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'صاحب المتجر',
            'phone' => '01000000001',
            'password' => bcrypt('password123'),
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->mainBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'MAIN-01',
            'type' => BranchType::STORE,
            'is_main' => true,
            'is_active' => true,
        ]);
    }

    /**
     * Item 1: ProductRequest rejects XSS payloads and special characters in barcode
     */
    public function test_product_request_rejects_xss_payload_in_barcode(): void
    {
        $response = $this->actingAs($this->owner)->postJson('/api/products', [
            'name' => 'منتج اختبار أمان',
            'purchase_price' => 50,
            'sale_price' => 100,
            'barcode' => '"><img src=x onerror=alert(1)>',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['barcode']);
    }

    /**
     * Item 1: ImportService rejects XSS payloads and special characters in barcode
     */
    public function test_import_service_rejects_xss_payload_in_barcode(): void
    {
        $importService = app(\App\Services\ImportService::class);
        $result = $importService->previewProducts($this->owner, [
            [
                'name' => 'صنف مستورد',
                'barcode' => '"><img src=x onerror=alert(1)>',
                'purchase_price' => 50,
                'sale_price' => 100,
            ]
        ]);

        $this->assertEquals(0, $result['valid_count']);
        $this->assertEquals(1, $result['invalid_count']);
        $this->assertStringContainsString('رموز غير مسموحة', $result['rows'][0]['errors'][0]);
    }

    /**
     * Item 2: WooCommerceSettingsController::saveSettings does not leak consumer_secret or full consumer_key
     */
    public function test_save_settings_does_not_leak_consumer_secrets_or_full_keys(): void
    {
        $mockClient = \Mockery::mock(\App\Services\WooCommerce\WooCommerceApiClient::class);
        $mockClient->shouldReceive('registerWebhooks')->andReturnTrue();
        $this->app->instance(\App\Services\WooCommerce\WooCommerceApiClient::class, $mockClient);

        $response = $this->actingAs($this->owner)->postJson('/api/woocommerce/settings', [
            'store_url' => 'https://example-shop.com',
            'consumer_key' => 'ck_super_secret_key_1234567890',
            'consumer_secret' => 'cs_ultra_private_secret_9876543210',
            'is_active' => true,
        ]);

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertArrayNotHasKey('consumer_secret', $data);
        $this->assertArrayNotHasKey('consumer_key', $data);
        $this->assertStringNotContainsString('cs_ultra_private_secret_9876543210', json_encode($data));
        $this->assertStringNotContainsString('ck_super_secret_key_1234567890', json_encode($data));
        $this->assertEquals('ck_supe...7890', $data['consumer_key_preview']);
        $this->assertNotEmpty($data['webhook_secret']);
    }

    /**
     * Item 3: Cashier settle courier exceeding balance throws 422
     */
    public function test_cashier_settle_courier_exceeding_balance_throws_422(): void
    {
        $cashier = User::create([
            'name' => 'كاشير الفرع',
            'phone' => '01011111111',
            'password' => bcrypt('password123'),
            'role' => \App\Enums\UserRole::CASHIER->value,
            'owner_id' => $this->owner->id,
            'branch_id' => $this->mainBranch->id,
            'status' => 'ACTIVE',
        ]);

        $courier = \App\Models\Party::create([
            'user_id' => $this->owner->id,
            'name' => 'شركة أمان للشحن',
            'type' => \App\Enums\PartyType::COURIER->value,
            'balance' => 500,
        ]);

        $response = $this->actingAs($cashier)->postJson("/api/couriers/{$courier->id}/settle", [
            'amount' => 600,
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'error_code' => 'SETTLEMENT_EXCEEDS_BALANCE',
        ]);
    }

    /**
     * Item 3: Courier settlement direction mismatch throws 422
     */
    public function test_courier_settlement_direction_mismatch_throws_422(): void
    {
        $cashier = User::create([
            'name' => 'كاشير الفرع 2',
            'phone' => '01011111112',
            'password' => bcrypt('password123'),
            'role' => \App\Enums\UserRole::CASHIER->value,
            'owner_id' => $this->owner->id,
            'branch_id' => $this->mainBranch->id,
            'status' => 'ACTIVE',
        ]);

        $courier = \App\Models\Party::create([
            'user_id' => $this->owner->id,
            'name' => 'شركة أمان للشحن 2',
            'type' => \App\Enums\PartyType::COURIER->value,
            'balance' => 500, // Positive balance requires RECEIPT
        ]);

        $response = $this->actingAs($cashier)->postJson("/api/couriers/{$courier->id}/settle", [
            'amount' => 200,
            'type' => 'PAYMENT',
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'error_code' => 'SETTLEMENT_DIRECTION_MISMATCH',
        ]);
    }

    /**
     * Item 3: POST /api/couriers/sync returns 404 (dead route removed)
     */
    public function test_courier_sync_route_returns_404(): void
    {
        $response = $this->actingAs($this->owner)->postJson('/api/couriers/sync');
        $response->assertStatus(404);
    }

    /**
     * Item 3 (Regression Guard): Cashier can settle courier within balance
     */
    public function test_cashier_can_settle_courier_within_balance_regression_guard(): void
    {
        $cashier = User::create([
            'name' => 'كاشير الفرع 3',
            'phone' => '01011111113',
            'password' => bcrypt('password123'),
            'role' => \App\Enums\UserRole::CASHIER->value,
            'owner_id' => $this->owner->id,
            'branch_id' => $this->mainBranch->id,
            'status' => 'ACTIVE',
        ]);

        $courier = \App\Models\Party::create([
            'user_id' => $this->owner->id,
            'name' => 'شركة أمان للشحن 3',
            'type' => \App\Enums\PartyType::COURIER->value,
            'balance' => 500,
        ]);

        $response = $this->actingAs($cashier)->postJson("/api/couriers/{$courier->id}/settle", [
            'amount' => 300,
        ]);

        $response->assertStatus(200);
        $this->assertEquals(200, $courier->fresh()->balance);
    }

    /**
     * Item 4: Change password revokes old tokens except current
     */
    public function test_change_password_revokes_old_tokens_except_current(): void
    {
        $oldToken = $this->owner->createToken('old-phone')->plainTextToken;
        $currentToken = $this->owner->createToken('current-web')->plainTextToken;

        $response = $this->withToken($currentToken)->postJson('/api/auth/change-password', [
            'current_password' => 'password123',
            'new_password' => 'newpassword123',
            'new_password_confirmation' => 'newpassword123',
        ]);
        $response->assertStatus(200);

        $this->app['auth']->forgetGuards();
        $oldResponse = $this->withToken($oldToken)->getJson('/api/auth/me');
        $oldResponse->assertStatus(401);

        $this->app['auth']->forgetGuards();
        $currentResponse = $this->withToken($currentToken)->getJson('/api/auth/me');
        $currentResponse->assertStatus(200);
    }

    /**
     * Item 4: Admin reset password revokes all tokens
     */
    public function test_admin_reset_password_revokes_all_tokens(): void
    {
        $token = $this->owner->createToken('device')->plainTextToken;

        $adminService = app(\App\Services\AdminStatsService::class);
        $adminService->resetUserPassword($this->owner, 'newAdminPass123');

        $this->app['auth']->forgetGuards();
        $response = $this->withToken($token)->getJson('/api/auth/me');
        $response->assertStatus(401);
    }

    /**
     * Item 4: Toggle merchant inactive revokes tokens
     */
    public function test_toggle_merchant_inactive_revokes_tokens(): void
    {
        $token = $this->owner->createToken('device')->plainTextToken;

        $adminService = app(\App\Services\AdminStatsService::class);
        $adminService->toggleUserStatus($this->owner);

        $this->app['auth']->forgetGuards();
        $response = $this->withToken($token)->getJson('/api/auth/me');
        $response->assertStatus(401);
    }

    /**
     * Item 4: Toggle employee inactive revokes tokens
     */
    public function test_toggle_employee_inactive_revokes_tokens(): void
    {
        $employee = User::create([
            'name' => 'موظف تجربة',
            'phone' => '01055555555',
            'password' => bcrypt('password123'),
            'role' => \App\Enums\UserRole::CASHIER->value,
            'owner_id' => $this->owner->id,
            'branch_id' => $this->mainBranch->id,
            'status' => 'ACTIVE',
        ]);
        $token = $employee->createToken('pos-device')->plainTextToken;

        $employeeService = app(\App\Services\EmployeeService::class);
        $employeeService->toggleStatus($employee);

        $this->app['auth']->forgetGuards();
        $response = $this->withToken($token)->getJson('/api/auth/me');
        $response->assertStatus(401);
    }

    /**
     * Item 5: Login rate limiting triggers 429 on sixth attempt
     */
    public function test_login_rate_limiting_triggers_429_on_sixth_attempt(): void
    {
        $payload = [
            'phone' => '01099999999',
            'password' => 'wrongpassword',
        ];

        for ($i = 1; $i <= 5; $i++) {
            $response = $this->postJson('/api/auth/login', $payload);
            $this->assertNotEquals(429, $response->status(), "Attempt $i should not be rate-limited");
        }

        $sixthResponse = $this->postJson('/api/auth/login', $payload);
        $sixthResponse->assertStatus(429);
    }

    /**
     * Item 6: AdminUserSeeder throws \RuntimeException when password is short or empty
     */
    public function test_admin_seeder_throws_when_password_is_short_or_empty(): void
    {
        config([
            'pos.admin.email' => 'admin@example.com',
            'pos.admin.phone' => '01012345678',
            'pos.admin.password' => 'short123',
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('كلمة مرور حساب المدير العام غير آمنة');

        $seeder = new \Database\Seeders\AdminUserSeeder();
        $seeder->run();
    }

    /**
     * Item 7: SSRF Protection rejects http, localhost, private, and link-local IPs
     */
    public function test_store_url_rejects_http_and_private_loopback_ips(): void
    {
        $fakeResolver = new class implements \App\Contracts\HostResolver {
            public function resolve(string $host): array
            {
                return match ($host) {
                    'example.com' => ['93.184.216.34'],
                    'evil-internal.local' => ['127.0.0.1'],
                    'internal-metadata.com' => ['169.254.169.254'],
                    'private-lan.com' => ['192.168.1.100'],
                    default => [],
                };
            }
        };
        $this->app->instance(\App\Contracts\HostResolver::class, $fakeResolver);

        $mockClient = \Mockery::mock(\App\Services\WooCommerce\WooCommerceApiClient::class);
        $mockClient->shouldReceive('registerWebhooks')->andReturnTrue();
        $this->app->instance(\App\Services\WooCommerce\WooCommerceApiClient::class, $mockClient);

        $validKeys = [
            'consumer_key' => 'ck_test_key_12345',
            'consumer_secret' => 'cs_test_secret_67890',
        ];

        // 1) http rejected
        $r1 = $this->actingAs($this->owner)->postJson('/api/woocommerce/settings', array_merge($validKeys, [
            'store_url' => 'http://example.com',
        ]));
        $r1->assertStatus(422)->assertJsonValidationErrors(['store_url']);

        // 2) localhost rejected
        $r2 = $this->actingAs($this->owner)->postJson('/api/woocommerce/settings', array_merge($validKeys, [
            'store_url' => 'https://localhost',
        ]));
        $r2->assertStatus(422)->assertJsonValidationErrors(['store_url']);

        // 3) 127.0.0.1 rejected
        $r3 = $this->actingAs($this->owner)->postJson('/api/woocommerce/settings', array_merge($validKeys, [
            'store_url' => 'https://127.0.0.1',
        ]));
        $r3->assertStatus(422)->assertJsonValidationErrors(['store_url']);

        // 4) 169.254.169.254 rejected
        $r4 = $this->actingAs($this->owner)->postJson('/api/woocommerce/settings', array_merge($validKeys, [
            'store_url' => 'https://169.254.169.254',
        ]));
        $r4->assertStatus(422)->assertJsonValidationErrors(['store_url']);

        // 5) resolved domain to private IP rejected
        $r5 = $this->actingAs($this->owner)->postJson('/api/woocommerce/settings', array_merge($validKeys, [
            'store_url' => 'https://private-lan.com',
        ]));
        $r5->assertStatus(422)->assertJsonValidationErrors(['store_url']);

        // 6) GenerateAuthUrlRequest also rejects http
        $r6 = $this->actingAs($this->owner)->getJson('/api/woocommerce/authorize-url?store_url=' . urlencode('http://example.com'));
        $r6->assertStatus(422)->assertJsonValidationErrors(['store_url']);

        // 7) Public HTTPS URL accepted
        $r7 = $this->actingAs($this->owner)->postJson('/api/woocommerce/settings', array_merge($validKeys, [
            'store_url' => 'https://example.com',
        ]));
        $r7->assertStatus(200);
    }
}
