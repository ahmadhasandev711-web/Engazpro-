<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\ProductType;
use App\Enums\PromotionDiscountType;
use App\Enums\PromotionSyncSource;
use App\Enums\PromotionType;
use App\Enums\ShopifyAuthMode;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Jobs\ProcessShopifyWebhookJob;
use App\Jobs\ProcessWooCommerceWebhookJob;
use App\Jobs\PushPriceToShopifyJob;
use App\Jobs\PushPriceToWooCommerceJob;
use App\Jobs\PushPromotionToEcommerceJob;
use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Promotion;
use App\Models\ShopifyIntegration;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\ProductService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EcommercePriceAndPromotionsTwoWaySyncTest extends TestCase
{
    use RefreshDatabase;

    private User $ownerA;
    private User $ownerB;
    private Branch $branchA;
    private Branch $branchASecondary;
    private Branch $branchB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ownerA = $this->createOwner('01060000001', 'Owner A Store');
        $this->ownerB = $this->createOwner('01060000002', 'Owner B Store');

        $this->branchA = Branch::create([
            'user_id' => $this->ownerA->id, 'name' => 'فرع الأونلاين A',
            'code' => 'BR-OA', 'type' => BranchType::STORE->value, 'is_main' => true, 'is_active' => true,
        ]);
        $this->branchASecondary = Branch::create([
            'user_id' => $this->ownerA->id, 'name' => 'فرع المعرض المحلي',
            'code' => 'BR-LA', 'type' => BranchType::STORE->value, 'is_main' => false, 'is_active' => true,
        ]);
        $this->branchB = Branch::create([
            'user_id' => $this->ownerB->id, 'name' => 'فرع B',
            'code' => 'BR-OB', 'type' => BranchType::STORE->value, 'is_main' => true, 'is_active' => true,
        ]);
    }

    private function createOwner(string $phone, string $name): User
    {
        $owner = User::create([
            'name' => $name, 'phone' => $phone, 'password' => bcrypt('secret123'),
            'role' => UserRole::OWNER->value, 'status' => UserStatus::ACTIVE->value,
            'ecommerce_enabled' => true,
        ]);
        Subscription::create([
            'user_id' => $owner->id, 'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => SubscriptionStatus::ACTIVE->value, 'plan' => 'PRO',
        ]);

        return $owner;
    }

    private function createWcIntegration(User $owner, Branch $branch, bool $prices = true, bool $promos = true): WooCommerceIntegration
    {
        return WooCommerceIntegration::create([
            'user_id' => $owner->id,
            'store_url' => 'https://wc-fashion.example.com',
            'consumer_key' => 'ck_test_key',
            'consumer_secret' => 'cs_test_secret',
            'webhook_secret' => 'wc_wh_secret_123',
            'online_branch_id' => $branch->id,
            'auto_sync_stock' => true,
            'auto_sync_prices' => $prices,
            'auto_sync_promotions' => $promos,
            'is_active' => true,
        ]);
    }

    private function createShopifyIntegration(User $owner, Branch $branch, bool $prices = true, bool $promos = true): ShopifyIntegration
    {
        return ShopifyIntegration::create([
            'user_id' => $owner->id,
            'shop_domain' => 'fashion.myshopify.com',
            'auth_mode' => ShopifyAuthMode::ACCESS_TOKEN,
            'access_token' => 'shpat_live_token_2026',
            'webhook_secret' => 'shopify_wh_secret_123',
            'default_branch_id' => $branch->id,
            'auto_sync_stock' => true,
            'auto_sync_prices' => $prices,
            'auto_sync_promotions' => $promos,
            'is_active' => true,
        ]);
    }

    public function test_woocommerce_simple_product_price_and_clear_sale_price_push(): void
    {
        $this->createWcIntegration($this->ownerA, $this->branchA);

        $recorded = [];
        Http::fake(function ($request) use (&$recorded) {
            $recorded[] = ['method' => $request->method(), 'url' => $request->url(), 'data' => $request->data()];
            return Http::response(['id' => 501], 200);
        });

        $product = Product::create([
            'user_id' => $this->ownerA->id, 'name' => 'تيشيرت أوفرسايز', 'unit' => 'قطعة',
            'regular_price' => 300, 'sale_price' => 240, 'purchase_price' => 150,
            'quantity' => 10, 'wc_product_id' => 501, 'type' => ProductType::STANDARD->value,
        ]);

        (new PushPriceToWooCommerceJob($this->ownerA->id, $product->id))->handle(app(\App\Services\WooCommerce\WooCommercePricePushService::class));
        $this->assertSame('300.00', $recorded[0]['data']['regular_price']);
        $this->assertSame('240.00', $recorded[0]['data']['sale_price']);

        $product->update(['regular_price' => 250, 'sale_price' => 250]);
        (new PushPriceToWooCommerceJob($this->ownerA->id, $product->id))->handle(app(\App\Services\WooCommerce\WooCommercePricePushService::class));
        $this->assertSame('250.00', $recorded[1]['data']['regular_price']);
        $this->assertSame('', $recorded[1]['data']['sale_price']);
    }

    public function test_woocommerce_variable_product_edit_coalesces_all_variants_into_one_batch_call(): void
    {
        Queue::fake();
        $this->createWcIntegration($this->ownerA, $this->branchA);

        $product = Product::create([
            'user_id' => $this->ownerA->id, 'name' => 'جاكيت شتوي', 'unit' => 'قطعة',
            'regular_price' => 900, 'sale_price' => 800, 'purchase_price' => 450,
            'quantity' => 0, 'wc_product_id' => 700, 'type' => ProductType::VARIABLE->value, 'has_variants' => true,
        ]);
        $v1 = ProductVariant::create(['user_id' => $this->ownerA->id, 'product_id' => $product->id, 'name' => 'S - أسود', 'regular_price' => 900, 'sale_price' => 800, 'wc_variation_id' => 701]);
        $v2 = ProductVariant::create(['user_id' => $this->ownerA->id, 'product_id' => $product->id, 'name' => 'M - أسود', 'regular_price' => 900, 'sale_price' => 800, 'wc_variation_id' => 702]);
        $v3 = ProductVariant::create(['user_id' => $this->ownerA->id, 'product_id' => $product->id, 'name' => 'L - أسود', 'regular_price' => 950, 'sale_price' => 850, 'wc_variation_id' => 703]);

        Sanctum::actingAs($this->ownerA);
        app(ProductService::class)->updateProduct($product, [
            'name' => 'جاكيت شتوي معدّل',
            'regular_price' => 1000,
            'sale_price' => 750,
            'variants' => [
                ['id' => $v1->id, 'name' => 'S - أسود', 'regular_price' => 1000, 'sale_price' => 750],
                ['id' => $v2->id, 'name' => 'M - أسود', 'regular_price' => 1000, 'sale_price' => 780],
                ['id' => $v3->id, 'name' => 'L - أسود', 'regular_price' => 1050, 'sale_price' => 820],
            ],
        ]);

        Queue::assertPushed(PushPriceToWooCommerceJob::class, 1);

        $batchCalls = [];
        Http::fake(function ($request) use (&$batchCalls) {
            $batchCalls[] = ['url' => $request->url(), 'data' => $request->data()];
            return Http::response(['update' => [['id' => 701], ['id' => 702], ['id' => 703]]], 200);
        });

        (new PushPriceToWooCommerceJob($this->ownerA->id, $product->id))->handle(app(\App\Services\WooCommerce\WooCommercePricePushService::class));

        $this->assertCount(1, $batchCalls);
        $this->assertStringContainsString('/wp-json/wc/v3/products/700/variations/batch', $batchCalls[0]['url']);
        $this->assertCount(3, $batchCalls[0]['data']['update']);
        $this->assertSame('750.00', $batchCalls[0]['data']['update'][0]['sale_price']);
        $this->assertSame('1050.00', $batchCalls[0]['data']['update'][2]['regular_price']);
    }

    public function test_shopify_2026_10_bulk_price_update_and_config_scopes(): void
    {
        $this->assertSame('2026-10', config('services.shopify.api_version'));
        $scopes = (string) config('services.shopify.scopes');
        $this->assertStringContainsString('write_products', $scopes);
        $this->assertStringContainsString('read_discounts', $scopes);
        $this->assertStringContainsString('write_discounts', $scopes);

        $this->createShopifyIntegration($this->ownerA, $this->branchA);
        $product = Product::create([
            'user_id' => $this->ownerA->id, 'name' => 'بنطلون كارجو', 'unit' => 'قطعة',
            'regular_price' => 500, 'sale_price' => 399.5, 'purchase_price' => 220,
            'quantity' => 5, 'shopify_product_id' => 8801, 'shopify_variant_id' => 9901,
            'type' => ProductType::STANDARD->value,
        ]);

        $captured = null;
        Http::fake(function ($request) use (&$captured) {
            $captured = $request->data();
            return Http::response([
                'data' => [
                    'productVariantsBulkUpdate' => [
                        'productVariants' => [['id' => 'gid://shopify/ProductVariant/9901', 'price' => '399.50', 'compareAtPrice' => '500.00']],
                        'userErrors' => [],
                    ],
                ],
            ], 200);
        });

        (new PushPriceToShopifyJob($this->ownerA->id, $product->id))->handle(app(\App\Services\Shopify\ShopifyPricePushService::class));

        $this->assertNotNull($captured);
        $this->assertStringContainsString('productVariantsBulkUpdate', $captured['query']);
        $this->assertStringNotContainsString('media', $captured['query']);
        $this->assertSame('gid://shopify/Product/8801', $captured['variables']['productId']);
        $this->assertSame('399.50', $captured['variables']['variants'][0]['price']);
        $this->assertSame('500.00', $captured['variables']['variants'][0]['compareAtPrice']);
    }

    public function test_anti_loop_echo_guard_and_wc_webhook_deduplication(): void
    {
        Queue::fake();
        $wc = $this->createWcIntegration($this->ownerA, $this->branchA);
        $product = Product::create([
            'user_id' => $this->ownerA->id, 'name' => 'هودي قطن', 'unit' => 'قطعة',
            'regular_price' => 450, 'sale_price' => 350, 'purchase_price' => 200,
            'quantity' => 12, 'wc_product_id' => 331, 'type' => ProductType::STANDARD->value,
        ]);

        Http::fake(['*' => Http::response(['id' => 331], 200)]);
        (new PushPriceToWooCommerceJob($this->ownerA->id, $product->id))->handle(app(\App\Services\WooCommerce\WooCommercePricePushService::class));

        $echoPayload = json_encode(['id' => 331, 'name' => 'هودي قطن', 'type' => 'simple', 'regular_price' => '450.00', 'sale_price' => '350.00', 'price' => '350.00']);
        $sigEcho = base64_encode(hash_hmac('sha256', $echoPayload, $wc->webhook_secret, true));

        $this->call('POST', "/api/webhooks/woocommerce/{$this->ownerA->id}", [], [], [], [
            'HTTP_X_WC_WEBHOOK_SIGNATURE' => $sigEcho,
            'HTTP_X_WC_WEBHOOK_TOPIC' => 'product.updated',
            'HTTP_X_WC_WEBHOOK_DELIVERY_ID' => 'deliv-wc-100',
            'CONTENT_TYPE' => 'application/json',
        ], $echoPayload)->assertStatus(202);

        $this->call('POST', "/api/webhooks/woocommerce/{$this->ownerA->id}", [], [], [], [
            'HTTP_X_WC_WEBHOOK_SIGNATURE' => $sigEcho,
            'HTTP_X_WC_WEBHOOK_TOPIC' => 'product.updated',
            'HTTP_X_WC_WEBHOOK_DELIVERY_ID' => 'deliv-wc-100',
            'CONTENT_TYPE' => 'application/json',
        ], $echoPayload)->assertStatus(200)->assertJsonPath('message', 'Duplicate WooCommerce webhook ignored');

        (new ProcessWooCommerceWebhookJob($this->ownerA->id, 'product.updated', json_decode($echoPayload, true)))
            ->handle(
                app(\App\Services\OnlineOrders\OnlineOrderIngestionService::class),
                app(\App\Services\WooCommerce\WooCommerceProductImportService::class),
                app(\App\Services\WooCommerce\WooCommercePromotionSyncService::class)
            );

        Queue::assertNotPushed(PushPriceToWooCommerceJob::class);

        $externalEdit = ['id' => 331, 'name' => 'هودي قطن معدّل', 'type' => 'simple', 'regular_price' => '420.00', 'sale_price' => '', 'price' => '420.00'];
        (new ProcessWooCommerceWebhookJob($this->ownerA->id, 'product.updated', $externalEdit))
            ->handle(
                app(\App\Services\OnlineOrders\OnlineOrderIngestionService::class),
                app(\App\Services\WooCommerce\WooCommerceProductImportService::class),
                app(\App\Services\WooCommerce\WooCommercePromotionSyncService::class)
            );

        $this->assertEquals(420.0, (float) $product->fresh()->sale_price);
        Queue::assertNotPushed(PushPriceToWooCommerceJob::class);
    }

    public function test_shopify_product_webhook_echo_guard_and_inbound_price_update(): void
    {
        Queue::fake();
        $this->createShopifyIntegration($this->ownerA, $this->branchA);
        $product = Product::create([
            'user_id' => $this->ownerA->id, 'name' => 'حذاء رياضي', 'unit' => 'زوج',
            'regular_price' => 600, 'sale_price' => 480, 'purchase_price' => 280,
            'quantity' => 6, 'shopify_product_id' => 4401, 'shopify_variant_id' => 4402,
            'type' => ProductType::STANDARD->value,
        ]);

        Http::fake([
            'https://fashion.myshopify.com/admin/api/2026-10/graphql.json' => Http::sequence()
                ->push(['data' => ['productVariantsBulkUpdate' => ['productVariants' => [['id' => 'gid://shopify/ProductVariant/4402', 'price' => '480.00', 'compareAtPrice' => '600.00']], 'userErrors' => []]]])
                ->push(['data' => ['product' => ['id' => 'gid://shopify/Product/4401', 'title' => 'حذاء رياضي', 'hasOnlyDefaultVariant' => true, 'status' => 'ACTIVE', 'variants' => ['edges' => [['node' => ['id' => 'gid://shopify/ProductVariant/4402', 'title' => 'Default Title', 'price' => '480.00', 'compareAtPrice' => '600.00', 'inventoryItem' => ['id' => 'gid://shopify/InventoryItem/55', 'tracked' => true]]]]]]]])
                ->push(['data' => ['product' => ['id' => 'gid://shopify/Product/4401', 'title' => 'حذاء رياضي', 'hasOnlyDefaultVariant' => true, 'status' => 'ACTIVE', 'variants' => ['edges' => [['node' => ['id' => 'gid://shopify/ProductVariant/4402', 'title' => 'Default Title', 'price' => '510.00', 'compareAtPrice' => null, 'inventoryItem' => ['id' => 'gid://shopify/InventoryItem/55', 'tracked' => true]]]]]]]]),
        ]);

        (new PushPriceToShopifyJob($this->ownerA->id, $product->id))->handle(app(\App\Services\Shopify\ShopifyPricePushService::class));

        $jobEcho = new ProcessShopifyWebhookJob($this->ownerA->id, 'products/update', ['id' => 4401]);
        $jobEcho->handle(
            app(\App\Services\OnlineOrders\OnlineOrderIngestionService::class),
            app(\App\Contracts\ShopifyGraphqlClientInterface::class),
            app(\App\Services\Shopify\ShopifyProductImportService::class),
            app(\App\Services\Shopify\ShopifySettingsService::class),
            app(\App\Services\Shopify\ShopifyPromotionSyncService::class)
        );
        Queue::assertNotPushed(PushPriceToShopifyJob::class);

        $jobReal = new ProcessShopifyWebhookJob($this->ownerA->id, 'products/update', ['id' => 4401]);
        $jobReal->handle(
            app(\App\Services\OnlineOrders\OnlineOrderIngestionService::class),
            app(\App\Contracts\ShopifyGraphqlClientInterface::class),
            app(\App\Services\Shopify\ShopifyProductImportService::class),
            app(\App\Services\Shopify\ShopifySettingsService::class),
            app(\App\Services\Shopify\ShopifyPromotionSyncService::class)
        );
        $this->assertEquals(510.0, (float) $product->fresh()->sale_price);
        Queue::assertNotPushed(PushPriceToShopifyJob::class);
    }

    public function test_two_way_woocommerce_coupons_push_pull_delete_and_webhook(): void
    {
        $this->createWcIntegration($this->ownerA, $this->branchA);
        Sanctum::actingAs($this->ownerA);

        $wcRequests = [];
        Http::fake(function ($request) use (&$wcRequests) {
            $wcRequests[] = ['method' => $request->method(), 'url' => $request->url(), 'data' => $request->data()];
            if ($request->method() === 'POST' && str_contains($request->url(), '/wp-json/wc/v3/coupons')) {
                return Http::response(['id' => 911, 'code' => 'summer25'], 201);
            }
            if ($request->method() === 'DELETE' && str_contains($request->url(), '/wp-json/wc/v3/coupons/911')) {
                return Http::response(['id' => 911], 200);
            }
            if ($request->method() === 'GET' && str_contains($request->url(), '/wp-json/wc/v3/coupons')) {
                return Http::response([
                    [
                        'id' => 922,
                        'code' => 'welcome50',
                        'discount_type' => 'fixed_cart',
                        'amount' => '50.00',
                        'description' => 'ترحيب المتجر',
                        'minimum_amount' => '200.00',
                        'usage_limit' => 100,
                        'usage_count' => 4,
                        'status' => 'publish',
                    ],
                ], 200);
            }

            return Http::response([], 200);
        });

        $createRes = $this->postJson('/api/promotions', [
            'name' => 'خصم الصيف 25%',
            'code' => 'SUMMER25',
            'type' => PromotionType::COUPON->value,
            'discount_type' => PromotionDiscountType::PERCENTAGE->value,
            'discount_value' => 25,
            'is_active' => true,
            'sync_to_ecommerce' => true,
        ])->assertStatus(201);

        $promoId = (int) $createRes->json('data.id');
        $promo = Promotion::findOrFail($promoId);
        $this->assertSame(911, $promo->wc_coupon_id);
        $this->assertNull($promo->sync_error);
        $this->assertNotNull($promo->last_synced_at);

        $this->postJson('/api/woocommerce/sync-coupons')->assertOk();
        $pulled = Promotion::where('user_id', $this->ownerA->id)->where('code', 'WELCOME50')->firstOrFail();
        $this->assertSame(PromotionSyncSource::WOOCOMMERCE, $pulled->sync_source);
        $this->assertEquals(50.0, (float) $pulled->discount_value);

        (new ProcessWooCommerceWebhookJob($this->ownerA->id, 'coupon.updated', [
            'id' => 922,
            'code' => 'welcome50',
            'discount_type' => 'fixed_cart',
            'amount' => '75.00',
            'minimum_amount' => '300.00',
            'usage_limit' => 50,
            'usage_count' => 6,
            'status' => 'publish',
        ]))->handle(
            app(\App\Services\OnlineOrders\OnlineOrderIngestionService::class),
            app(\App\Services\WooCommerce\WooCommerceProductImportService::class),
            app(\App\Services\WooCommerce\WooCommercePromotionSyncService::class)
        );
        $this->assertEquals(75.0, (float) $pulled->fresh()->discount_value);

        $this->deleteJson("/api/promotions/{$promoId}")->assertOk();
        $this->assertTrue(collect($wcRequests)->contains(fn ($r) => $r['method'] === 'DELETE' && str_contains($r['url'], '/coupons/911')));
    }

    public function test_two_way_shopify_2026_10_coupons_and_bxgy_push_and_pull(): void
    {
        $this->createShopifyIntegration($this->ownerA, $this->branchA);
        Sanctum::actingAs($this->ownerA);

        $gqlQueries = [];
        Http::fake(function ($request) use (&$gqlQueries) {
            $body = $request->data();
            $gqlQueries[] = $body;

            if (str_contains($body['query'], 'discountCodeBasicCreate')) {
                return Http::response(['data' => ['discountCodeBasicCreate' => ['codeDiscountNode' => ['id' => 'gid://shopify/DiscountCodeNode/111'], 'userErrors' => []]]], 200);
            }
            if (str_contains($body['query'], 'discountAutomaticBxgyCreate')) {
                return Http::response(['data' => ['discountAutomaticBxgyCreate' => ['automaticDiscountNode' => ['id' => 'gid://shopify/DiscountAutomaticNode/222'], 'userErrors' => []]]], 200);
            }
            if (str_contains($body['query'], 'codeDiscountNodes')) {
                return Http::response([
                    'data' => [
                        'codeDiscountNodes' => [
                            'pageInfo' => ['hasNextPage' => false, 'endCursor' => null],
                            'nodes' => [[
                                'id' => 'gid://shopify/DiscountCodeNode/333',
                                'codeDiscount' => [
                                    'title' => 'عرض شوبيفاي 12.5%',
                                    'status' => 'ACTIVE',
                                    'codes' => ['nodes' => [['code' => 'SHP125']]],
                                    'customerGets' => ['value' => ['percentage' => 0.125]],
                                    'minimumRequirement' => ['greaterThanOrEqualToSubtotal' => ['amount' => '150.00']],
                                ],
                            ]],
                        ],
                    ],
                ], 200);
            }
            if (str_contains($body['query'], 'automaticDiscountNodes')) {
                return Http::response(['data' => ['automaticDiscountNodes' => ['pageInfo' => ['hasNextPage' => false, 'endCursor' => null], 'nodes' => []]]], 200);
            }

            return Http::response(['data' => []], 200);
        });

        $couponRes = $this->postJson('/api/promotions', [
            'name' => 'خصم VIP 15%',
            'code' => 'VIP15',
            'type' => PromotionType::COUPON->value,
            'discount_type' => PromotionDiscountType::PERCENTAGE->value,
            'discount_value' => 15,
            'sync_to_ecommerce' => true,
        ])->assertStatus(201);
        $this->assertSame('gid://shopify/DiscountCodeNode/111', Promotion::find($couponRes->json('data.id'))->shopify_discount_id);

        $codeCreateVars = collect($gqlQueries)->first(fn ($q) => str_contains($q['query'], 'discountCodeBasicCreate'))['variables']['basicCodeDiscount'];
        $this->assertEquals(0.15, $codeCreateVars['customerGets']['value']['percentage']);

        $bxgyRes = $this->postJson('/api/promotions', [
            'name' => 'اشتري 2 واحصل على 1 مجاناً',
            'type' => PromotionType::BUY_X_GET_Y->value,
            'discount_type' => PromotionDiscountType::PERCENTAGE->value,
            'discount_value' => 100,
            'buy_quantity' => 2,
            'get_quantity' => 1,
            'sync_to_ecommerce' => true,
        ])->assertStatus(201);
        $this->assertSame('gid://shopify/DiscountAutomaticNode/222', Promotion::find($bxgyRes->json('data.id'))->shopify_discount_id);

        $this->postJson('/api/shopify/sync-promotions')->assertOk();
        $pulled = Promotion::where('user_id', $this->ownerA->id)->where('code', 'SHP125')->firstOrFail();
        $this->assertSame(PromotionSyncSource::SHOPIFY, $pulled->sync_source);
        $this->assertEquals(12.5, (float) $pulled->discount_value);
        $this->assertEquals(150.0, (float) $pulled->min_order_amount);
    }

    public function test_shopify_access_denied_surfaces_clear_scope_warning_without_crashing(): void
    {
        $integration = $this->createShopifyIntegration($this->ownerA, $this->branchA);
        $promo = Promotion::withoutEvents(fn () => Promotion::create([
            'user_id' => $this->ownerA->id, 'name' => 'كوبون قديم', 'code' => 'LEGACY10',
            'type' => PromotionType::COUPON->value, 'discount_type' => PromotionDiscountType::PERCENTAGE->value,
            'discount_value' => 10, 'is_active' => true, 'sync_to_ecommerce' => true,
        ]));

        Http::fake([
            'https://fashion.myshopify.com/admin/api/2026-10/graphql.json' => Http::response([
                'errors' => [['message' => 'Access denied for discountCodeBasicCreate field.', 'extensions' => ['code' => 'ACCESS_DENIED']]],
            ], 200),
        ]);

        (new PushPromotionToEcommerceJob($this->ownerA->id, $promo->id, 'upsert'))->handle(
            app(\App\Services\WooCommerce\WooCommercePromotionSyncService::class),
            app(\App\Services\Shopify\ShopifyPromotionSyncService::class)
        );

        $this->assertStringContainsString('write_discounts', (string) $promo->fresh()->sync_error);
        $this->assertStringContainsString('write_products', (string) $integration->fresh()->last_error);
    }

    public function test_branch_and_tenant_isolation_for_ecommerce_price_and_promotion_sync(): void
    {
        $wcA = $this->createWcIntegration($this->ownerA, $this->branchA);
        $this->createWcIntegration($this->ownerB, $this->branchB);

        $branchScopedPromo = Promotion::create([
            'user_id' => $this->ownerA->id,
            'branch_id' => $this->branchASecondary->id,
            'name' => 'عرض المعرض المحلي فقط',
            'code' => 'LOCALBRANCH10',
            'type' => PromotionType::COUPON->value,
            'discount_type' => PromotionDiscountType::PERCENTAGE->value,
            'discount_value' => 10,
            'is_active' => true,
            'sync_to_ecommerce' => true,
        ]);

        Http::fake(fn () => Http::response([], 200));
        $pushed = app(\App\Services\WooCommerce\WooCommercePromotionSyncService::class)->pushPromotion($wcA, $branchScopedPromo);
        $this->assertFalse($pushed);
        Http::assertNothingSent();

        Product::create([
            'user_id' => $this->ownerA->id, 'name' => 'صنف للمستأجر A', 'unit' => 'قطعة',
            'regular_price' => 100, 'sale_price' => 90, 'purchase_price' => 50,
            'quantity' => 5, 'wc_product_id' => 901, 'type' => ProductType::STANDARD->value,
        ]);

        Sanctum::actingAs($this->ownerB);
        $this->postJson('/api/woocommerce/push-all-prices')->assertStatus(422);
    }
}
