<?php

namespace Tests\Feature;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\ShopifyAuthMode;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\ShopifyIntegration;
use App\Models\ShopifyLocationMapping;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ShopifyAuthAndSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $mainBranch;
    protected Branch $warehouseBranch;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => UserRole::OWNER->value, 'ecommerce_enabled' => true]);
        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => SubscriptionStatus::ACTIVE->value,
            'plan' => 'PRO',
        ]);

        $this->mainBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'المحل الرئيسي',
            'code' => 'BR-MAIN',
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->warehouseBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'مخزن مدينة نصر',
            'code' => 'BR-NASR',
            'is_main' => false,
            'is_active' => true,
        ]);
    }

    public function test_owner_can_save_access_token_settings_and_test_connection_with_locations_sync(): void
    {
        Http::fake([
            'https://my-fashion.myshopify.com/admin/api/2026-10/graphql.json' => Http::sequence()
                ->push(['data' => ['locations' => ['edges' => [
                    ['node' => ['id' => 'gid://shopify/Location/1001', 'name' => 'Main Warehouse', 'isActive' => true]],
                    ['node' => ['id' => 'gid://shopify/Location/1002', 'name' => 'Retail Store', 'isActive' => true]],
                ]]]])
                ->push(['data' => ['webhookSubscriptionCreate' => ['webhookSubscription' => ['id' => 'gid://shopify/WebhookSubscription/1', 'topic' => 'ORDERS_CREATE', 'uri' => 'https://app.test'], 'userErrors' => []]]])
                ->push(['data' => ['webhookSubscriptionCreate' => ['webhookSubscription' => ['id' => 'gid://shopify/WebhookSubscription/2', 'topic' => 'ORDERS_UPDATED', 'uri' => 'https://app.test'], 'userErrors' => []]]])
                ->push(['data' => ['webhookSubscriptionCreate' => ['webhookSubscription' => ['id' => 'gid://shopify/WebhookSubscription/3', 'topic' => 'ORDERS_CANCELLED', 'uri' => 'https://app.test'], 'userErrors' => []]]])
                ->push(['data' => ['webhookSubscriptionCreate' => ['webhookSubscription' => ['id' => 'gid://shopify/WebhookSubscription/4', 'topic' => 'ORDERS_EDITED', 'uri' => 'https://app.test'], 'userErrors' => []]]])
                ->push(['data' => ['webhookSubscriptionCreate' => ['webhookSubscription' => ['id' => 'gid://shopify/WebhookSubscription/5', 'topic' => 'REFUNDS_CREATE', 'uri' => 'https://app.test'], 'userErrors' => []]]])
                ->push(['data' => ['webhookSubscriptionCreate' => ['webhookSubscription' => ['id' => 'gid://shopify/WebhookSubscription/6', 'topic' => 'PRODUCTS_CREATE', 'uri' => 'https://app.test'], 'userErrors' => []]]])
                ->push(['data' => ['webhookSubscriptionCreate' => ['webhookSubscription' => ['id' => 'gid://shopify/WebhookSubscription/7', 'topic' => 'PRODUCTS_UPDATE', 'uri' => 'https://app.test'], 'userErrors' => []]]])
                ->push(['data' => ['webhookSubscriptionCreate' => ['webhookSubscription' => ['id' => 'gid://shopify/WebhookSubscription/8', 'topic' => 'LOCATIONS_UPDATE', 'uri' => 'https://app.test'], 'userErrors' => []]]])
                ->push(['data' => ['shop' => ['name' => 'My Fashion', 'currencyCode' => 'EGP', 'myshopifyDomain' => 'my-fashion.myshopify.com']]])
                ->push(['data' => ['locations' => ['edges' => [
                    ['node' => ['id' => 'gid://shopify/Location/1001', 'name' => 'Main Warehouse', 'isActive' => true]],
                    ['node' => ['id' => 'gid://shopify/Location/1002', 'name' => 'Retail Store', 'isActive' => true]],
                ]]]]),
        ]);

        $response = $this->actingAs($this->owner)->postJson('/api/shopify/settings', [
            'shop_domain' => 'https://my-fashion.myshopify.com/admin',
            'auth_mode' => ShopifyAuthMode::ACCESS_TOKEN->value,
            'access_token' => 'shpat_secret_1234567890abcd',
            'default_branch_id' => $this->mainBranch->id,
            'auto_sync_stock' => true,
            'is_active' => true,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.shop_domain', 'my-fashion.myshopify.com')
            ->assertJsonPath('data.access_token_preview', 'shpat_...abcd');

        // Multi-location stores must NOT auto-map every location to the same branch (prevents 2x overselling)
        $this->assertDatabaseHas('shopify_location_mappings', [
            'user_id' => $this->owner->id,
            'shopify_location_id' => 1001,
            'shopify_location_name' => 'Main Warehouse',
            'branch_id' => null,
            'auto_sync_stock' => false,
        ]);

        $testRes = $this->actingAs($this->owner)->postJson('/api/shopify/test-connection');
        $testRes->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.locations_count', 2);
    }

    public function test_client_credentials_mode_exchanges_and_caches_token(): void
    {
        Http::fake([
            'https://new-shop.myshopify.com/admin/oauth/access_token' => Http::response([
                'access_token' => 'shpat_generated_token_xyz',
                'expires_in' => 86399,
            ], 200),
            'https://new-shop.myshopify.com/admin/api/2026-10/graphql.json' => Http::response([
                'data' => ['shop' => ['name' => 'New Shop', 'currencyCode' => 'EGP', 'myshopifyDomain' => 'new-shop.myshopify.com']],
            ], 200),
        ]);

        $integration = ShopifyIntegration::create([
            'user_id' => $this->owner->id,
            'shop_domain' => 'new-shop.myshopify.com',
            'auth_mode' => ShopifyAuthMode::CLIENT_CREDENTIALS,
            'client_id' => 'dev_client_123',
            'client_secret' => 'dev_secret_456',
            'is_active' => true,
        ]);

        /** @var ShopifyGraphqlClientInterface $client */
        $client = app(ShopifyGraphqlClientInterface::class);
        $shop = $client->testConnection($integration);

        $this->assertSame('New Shop', $shop['name']);
        $this->assertSame('shpat_generated_token_xyz', $integration->fresh()->access_token);
        $this->assertNotNull($integration->fresh()->token_expires_at);
    }

    public function test_oauth_authorize_and_callback_flow_verifies_hmac_and_persists_integration(): void
    {
        config(['services.shopify.client_id' => 'platform_cid', 'services.shopify.client_secret' => 'platform_secret']);

        Http::fake([
            'https://oauth-shop.myshopify.com/admin/oauth/access_token' => Http::response(['access_token' => 'shpat_oauth_999'], 200),
            'https://oauth-shop.myshopify.com/admin/api/2026-10/graphql.json' => Http::response(['data' => ['locations' => ['edges' => []]]], 200),
        ]);

        $authUrlRes = $this->actingAs($this->owner)->getJson('/api/shopify/authorize-url?shop_domain=oauth-shop.myshopify.com');
        $authUrlRes->assertOk();
        parse_str((string) parse_url($authUrlRes->json('authorize_url'), PHP_URL_QUERY), $authParams);

        $callbackParams = [
            'code' => 'auth_code_123',
            'shop' => 'oauth-shop.myshopify.com',
            'state' => $authParams['state'],
            'timestamp' => (string) time(),
        ];
        ksort($callbackParams);
        $msg = collect($callbackParams)->map(fn ($v, $k) => "{$k}={$v}")->implode('&');
        $callbackParams['hmac'] = hash_hmac('sha256', $msg, 'platform_secret');

        $cbRes = $this->getJson('/api/shopify/auth-callback?' . http_build_query($callbackParams));
        $cbRes->assertOk()->assertJsonPath('data.shop_domain', 'oauth-shop.myshopify.com');

        $this->assertDatabaseHas('shopify_integrations', [
            'user_id' => $this->owner->id,
            'shop_domain' => 'oauth-shop.myshopify.com',
            'auth_mode' => ShopifyAuthMode::OAUTH->value,
            'is_active' => true,
        ]);
    }

    public function test_location_mappings_enforce_tenant_branch_isolation(): void
    {
        $integration = ShopifyIntegration::create([
            'user_id' => $this->owner->id,
            'shop_domain' => 'loc-shop.myshopify.com',
            'auth_mode' => ShopifyAuthMode::ACCESS_TOKEN,
            'access_token' => 'shpat_abc',
            'is_active' => true,
        ]);
        $loc1 = ShopifyLocationMapping::create([
            'user_id' => $this->owner->id,
            'shopify_integration_id' => $integration->id,
            'shopify_location_id' => 5001,
            'shopify_location_name' => 'Nasr City Hub',
        ]);
        $otherOwner = User::factory()->create(['role' => UserRole::OWNER->value, 'ecommerce_enabled' => true]);
        $foreignBranch = Branch::create(['user_id' => $otherOwner->id, 'name' => 'Foreign', 'code' => 'BR-F']);

        $this->actingAs($this->owner)->postJson('/api/shopify/location-mappings', [
            'mappings' => [['id' => $loc1->id, 'branch_id' => $foreignBranch->id, 'auto_sync_stock' => true]],
        ])->assertStatus(422);

        $this->actingAs($this->owner)->postJson('/api/shopify/location-mappings', [
            'mappings' => [['id' => $loc1->id, 'branch_id' => $this->warehouseBranch->id, 'auto_sync_stock' => true]],
        ])->assertOk();

        $this->assertDatabaseHas('shopify_location_mappings', [
            'id' => $loc1->id,
            'branch_id' => $this->warehouseBranch->id,
        ]);
    }

    public function test_set_inventory_quantities_uses_2026_04_idempotent_and_change_from_quantity(): void
    {
        $capturedRequest = null;
        Http::fake(function ($request) use (&$capturedRequest) {
            $capturedRequest = $request->data();

            return Http::response([
                'data' => ['inventorySetQuantities' => ['inventoryAdjustmentGroup' => ['reason' => 'correction'], 'userErrors' => []]],
            ], 200);
        });

        $integration = ShopifyIntegration::create([
            'user_id' => $this->owner->id,
            'shop_domain' => 'inv-shop.myshopify.com',
            'auth_mode' => ShopifyAuthMode::ACCESS_TOKEN,
            'access_token' => 'shpat_inv',
            'is_active' => true,
        ]);

        app(ShopifyGraphqlClientInterface::class)->setInventoryQuantities($integration, [[
            'inventoryItemId' => 'gid://shopify/InventoryItem/111',
            'locationId' => 'gid://shopify/Location/222',
            'quantity' => 15,
            'changeFromQuantity' => null,
        ]], 'idem-key-123');

        $this->assertStringContainsString('@idempotent(key: $idempotencyKey)', $capturedRequest['query']);
        $this->assertSame('idem-key-123', $capturedRequest['variables']['idempotencyKey']);
        $this->assertArrayHasKey('changeFromQuantity', $capturedRequest['variables']['input']['quantities'][0]);
        $this->assertNull($capturedRequest['variables']['input']['quantities'][0]['changeFromQuantity']);
    }

    public function test_enforces_one_to_one_branch_mapping_and_verifies_webhook_security(): void
    {
        $integration = ShopifyIntegration::create([
            'user_id' => $this->owner->id,
            'shop_domain' => 'secure-shop.myshopify.com',
            'auth_mode' => ShopifyAuthMode::CLIENT_CREDENTIALS,
            'client_id' => 'cid_1',
            'client_secret' => 'app_client_secret_xyz',
            'webhook_secret' => 'random_local_secret',
            'is_active' => true,
        ]);
        $locA = ShopifyLocationMapping::create([
            'user_id' => $this->owner->id, 'shopify_integration_id' => $integration->id,
            'shopify_location_id' => 7001, 'shopify_location_name' => 'Loc A',
        ]);
        $locB = ShopifyLocationMapping::create([
            'user_id' => $this->owner->id, 'shopify_integration_id' => $integration->id,
            'shopify_location_id' => 7002, 'shopify_location_name' => 'Loc B',
        ]);

        // Assigning two locations to the same branch must fail validation (1-to-1 rule)
        $this->actingAs($this->owner)->postJson('/api/shopify/location-mappings', [
            'mappings' => [
                ['id' => $locA->id, 'branch_id' => $this->mainBranch->id, 'auto_sync_stock' => true],
                ['id' => $locB->id, 'branch_id' => $this->mainBranch->id, 'auto_sync_stock' => true],
            ],
        ])->assertStatus(422);

        // App-registered webhook HMAC verified using client_secret + replay protection
        $payload = json_encode(['id' => 999888, 'name' => '#1099', 'line_items' => []]);
        $hmac = base64_encode(hash_hmac('sha256', $payload, 'app_client_secret_xyz', true));

        $this->call('POST', '/api/webhooks/shopify/' . $this->owner->id, [], [], [], [
            'HTTP_X-Shopify-Hmac-Sha256' => $hmac,
            'HTTP_X-Shopify-Topic' => 'orders/cancelled',
            'HTTP_X-Shopify-Shop-Domain' => 'evil-shop.myshopify.com',
            'HTTP_X-Shopify-Webhook-Id' => 'wh-evt-1',
            'CONTENT_TYPE' => 'application/json',
        ], $payload)->assertStatus(403);

        $this->call('POST', '/api/webhooks/shopify/' . $this->owner->id, [], [], [], [
            'HTTP_X-Shopify-Hmac-Sha256' => $hmac,
            'HTTP_X-Shopify-Topic' => 'orders/cancelled',
            'HTTP_X-Shopify-Shop-Domain' => 'secure-shop.myshopify.com',
            'HTTP_X-Shopify-Webhook-Id' => 'wh-evt-2',
            'CONTENT_TYPE' => 'application/json',
        ], $payload)->assertStatus(202);

        $this->call('POST', '/api/webhooks/shopify/' . $this->owner->id, [], [], [], [
            'HTTP_X-Shopify-Hmac-Sha256' => $hmac,
            'HTTP_X-Shopify-Topic' => 'orders/cancelled',
            'HTTP_X-Shopify-Shop-Domain' => 'secure-shop.myshopify.com',
            'HTTP_X-Shopify-Webhook-Id' => 'wh-evt-2',
            'CONTENT_TYPE' => 'application/json',
        ], $payload)->assertStatus(200)->assertJsonPath('message', 'Duplicate Shopify webhook ignored');
    }
}
