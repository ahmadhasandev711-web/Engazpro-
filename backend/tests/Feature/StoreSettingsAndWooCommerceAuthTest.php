<?php

namespace Tests\Feature;

use App\Contracts\WooCommerceApiClientInterface;
use App\Models\Branch;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class StoreSettingsAndWooCommerceAuthTest extends TestCase
{
    use RefreshDatabase;

    private function createOwnerWithSubscription(): User
    {
        $owner = User::create([
            'name' => 'مالك المتجر',
            'phone' => '01011111111',
            'password' => bcrypt('password'),
            'role' => 'OWNER',
            'status' => 'ACTIVE',
        ]);

        Subscription::create([
            'user_id' => $owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        Branch::create([
            'user_id' => $owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'BR-MAIN',
            'is_main' => true,
            'type' => 'STORE',
            'is_active' => true,
        ]);

        return $owner;
    }

    private function createEmployee(User $owner, string $role, string $phone): User
    {
        return User::create([
            'name' => "موظف {$role}",
            'phone' => $phone,
            'password' => bcrypt('password'),
            'owner_id' => $owner->id,
            'role' => $role,
            'status' => 'ACTIVE',
        ]);
    }

    public function test_store_identity_can_be_retrieved_and_updated_by_owner(): void
    {
        $owner = $this->createOwnerWithSubscription();

        // 1. Initial retrieval - defaults to owner name and phone, currency 'ج.م'
        $response = $this->actingAs($owner)->getJson('/api/settings/store-identity');
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.business_name', 'مالك المتجر')
            ->assertJsonPath('data.currency', 'ج.م');

        // 2. Update store identity
        $updateResp = $this->actingAs($owner)->putJson('/api/settings/store-identity', [
            'business_name' => 'براند فاشون للملابس',
            'store_phone' => '01199998888',
            'store_address' => 'شارع التحرير، الدقي، الجيزة',
            'currency' => 'EGP',
        ]);

        $updateResp->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.business_name', 'براند فاشون للملابس')
            ->assertJsonPath('data.currency', 'EGP');

        // 3. Confirm persistence
        $checkResp = $this->actingAs($owner)->getJson('/api/settings/store-identity');
        $checkResp->assertStatus(200)
            ->assertJsonPath('data.business_name', 'براند فاشون للملابس')
            ->assertJsonPath('data.store_phone', '01199998888');
    }

    public function test_cashier_can_read_store_identity_but_cannot_update(): void
    {
        $owner = $this->createOwnerWithSubscription();
        $cashier = $this->createEmployee($owner, 'CASHIER', '01022222222');

        // Cashier can read store identity (e.g. for printing receipt)
        $readResp = $this->actingAs($cashier)->getJson('/api/settings/store-identity');
        $readResp->assertStatus(200)
            ->assertJsonPath('success', true);

        // Cashier cannot update store identity (forbidden - 403)
        $updateResp = $this->actingAs($cashier)->putJson('/api/settings/store-identity', [
            'business_name' => 'محاولة اختراق',
            'currency' => 'USD',
        ]);
        $updateResp->assertStatus(403);
    }

    public function test_owner_can_get_authorize_url_and_manager_is_forbidden(): void
    {
        $owner = $this->createOwnerWithSubscription();
        $manager = $this->createEmployee($owner, 'MANAGER', '01033333333');

        // Owner gets authorize url
        $ownerResp = $this->actingAs($owner)->getJson('/api/woocommerce/authorize-url?store_url=https://example.com');
        $ownerResp->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertStringContainsString('https://example.com/wc-auth/v1/authorize', $ownerResp->json('data.authorize_url'));
        $this->assertStringContainsString('user_id=' . $owner->id, $ownerResp->json('data.authorize_url'));

        // Manager is strictly forbidden (403) from WooCommerce integration & auth
        $managerResp = $this->actingAs($manager)->getJson('/api/woocommerce/authorize-url?store_url=https://example.com');
        $managerResp->assertStatus(403);
    }

    public function test_cashier_cannot_get_authorize_url(): void
    {
        $owner = $this->createOwnerWithSubscription();
        $cashier = $this->createEmployee($owner, 'CASHIER', '01044444444');

        $resp = $this->actingAs($cashier)->getJson('/api/woocommerce/authorize-url?store_url=https://example.com');
        $resp->assertStatus(403);
    }

    public function test_auth_callback_stores_keys_idempotently(): void
    {
        $owner = $this->createOwnerWithSubscription();

        // Mock WooCommerceApiClientInterface to simulate currency detection
        $mockClient = Mockery::mock(WooCommerceApiClientInterface::class);
        $mockClient->shouldReceive('getStoreCurrency')->andReturn('ج.م');
        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);

        // 1. Calling without signature or with invalid signature fails with 403 (Security Guard)
        $unauthorizedResp = $this->postJson('/api/woocommerce/auth-callback?account_id=' . $owner->id, [
            'consumer_key' => 'ck_test_1234567890abcdef',
            'consumer_secret' => 'cs_test_0987654321fedcba',
        ]);
        $unauthorizedResp->assertStatus(403);

        $authService = app(\App\Services\WooCommerce\WooCommerceAuthService::class);
        $validSignature = $authService->generateCallbackSignature($owner->id);

        // First callback with valid signature
        $resp1 = $this->postJson("/api/woocommerce/auth-callback?account_id={$owner->id}&signature={$validSignature}", [
            'consumer_key' => 'ck_test_1234567890abcdef',
            'consumer_secret' => 'cs_test_0987654321fedcba',
        ]);

        $resp1->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.is_active', true);

        $this->assertDatabaseHas('woocommerce_integrations', [
            'user_id' => $owner->id,
            'is_active' => true,
        ]);

        // Second callback (idempotent - should update existing, not create duplicate)
        $resp2 = $this->postJson("/api/woocommerce/auth-callback?account_id={$owner->id}&signature={$validSignature}", [
            'consumer_key' => 'ck_test_updated_key',
            'consumer_secret' => 'cs_test_updated_secret',
        ]);

        $resp2->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertEquals(1, WooCommerceIntegration::where('user_id', $owner->id)->count());
    }

    public function test_owner_and_manager_can_pull_orders(): void
    {
        $owner = $this->createOwnerWithSubscription();
        $manager = $this->createEmployee($owner, 'MANAGER', '01055555555');

        WooCommerceIntegration::create([
            'user_id' => $owner->id,
            'store_url' => 'https://mystore.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'is_active' => true,
        ]);

        $mockClient = Mockery::mock(WooCommerceApiClientInterface::class);
        $mockClient->shouldReceive('getOrders')
            ->with(Mockery::any(), 'processing', 1, Mockery::any())
            ->andReturn([
                [
                    'id' => 901,
                    'status' => 'processing',
                    'total' => '250.00',
                    'shipping_total' => '30.00',
                    'discount_total' => '0.00',
                    'billing' => [
                        'first_name' => 'عميل',
                        'last_name' => 'ووكومرس',
                        'phone' => '01099887766',
                        'city' => 'القاهرة',
                    ],
                    'line_items' => [],
                ],
            ]);
        $mockClient->shouldReceive('getOrders')
            ->with(Mockery::any(), 'pending', 1, Mockery::any())
            ->andReturn([]);
        $mockClient->shouldReceive('getOrders')
            ->with(Mockery::any(), 'on-hold', 1, Mockery::any())
            ->andReturn([]);

        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);

        // Manager pulls orders
        $pullResp = $this->actingAs($manager)->postJson('/api/wc-orders/pull');
        $pullResp->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.imported', 1);

        $this->assertDatabaseHas('wc_orders', [
            'user_id' => $owner->id,
            'wc_order_id' => 901,
        ]);
    }

    public function test_cashier_and_mandob_cannot_pull_orders(): void
    {
        $owner = $this->createOwnerWithSubscription();
        $cashier = $this->createEmployee($owner, 'CASHIER', '01066666666');
        $mandob = $this->createEmployee($owner, 'MANDOB', '01077777777');

        $cashierResp = $this->actingAs($cashier)->postJson('/api/wc-orders/pull');
        $cashierResp->assertStatus(403);

        $mandobResp = $this->actingAs($mandob)->postJson('/api/wc-orders/pull');
        $mandobResp->assertStatus(403);
    }
}
