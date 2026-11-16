<?php

namespace Tests\Feature;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\ProductType;
use App\Enums\ShopifyAuthMode;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Jobs\ImportShopifyProductsPageJob;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShopifyIntegration;
use App\Models\ShopifyLocationMapping;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Shopify\ShopifyProductImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Mockery;
use Tests\TestCase;

class ShopifyProductImportTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $mainBranch;
    protected Branch $nasrBranch;
    protected ShopifyIntegration $integration;

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

        $this->mainBranch = Branch::create(['user_id' => $this->owner->id, 'name' => 'المحل', 'code' => 'BR-1', 'is_main' => true, 'is_active' => true]);
        $this->nasrBranch = Branch::create(['user_id' => $this->owner->id, 'name' => 'مدينة نصر', 'code' => 'BR-2', 'is_main' => false, 'is_active' => true]);

        $this->integration = ShopifyIntegration::create([
            'user_id' => $this->owner->id,
            'shop_domain' => 'catalog.myshopify.com',
            'auth_mode' => ShopifyAuthMode::ACCESS_TOKEN,
            'access_token' => 'shpat_catalog',
            'default_branch_id' => $this->mainBranch->id,
            'is_active' => true,
        ]);

        ShopifyLocationMapping::create([
            'user_id' => $this->owner->id,
            'shopify_integration_id' => $this->integration->id,
            'shopify_location_id' => 101,
            'shopify_location_name' => 'Main Location',
            'branch_id' => $this->mainBranch->id,
            'auto_sync_stock' => true,
            'is_active' => true,
        ]);
        ShopifyLocationMapping::create([
            'user_id' => $this->owner->id,
            'shopify_integration_id' => $this->integration->id,
            'shopify_location_id' => 102,
            'shopify_location_name' => 'Nasr Location',
            'branch_id' => $this->nasrBranch->id,
            'auto_sync_stock' => true,
            'is_active' => true,
        ]);
    }

    public function test_imports_simple_and_variable_products_with_compare_at_pricing_and_multi_location_stock(): void
    {
        $mock = Mockery::mock(ShopifyGraphqlClientInterface::class);
        $mock->shouldReceive('getProductsPage')->once()->andReturn([
            'has_next_page' => false,
            'end_cursor' => null,
            'products' => [
                [
                    'id' => 'gid://shopify/Product/7001',
                    'title' => 'كاب قطن كلاسيك',
                    'productType' => 'اكسسوارات',
                    'hasOnlyDefaultVariant' => true,
                    'featuredMedia' => ['preview' => ['image' => ['url' => 'https://cdn.shopify.com/cap.jpg']]],
                    'variants' => ['edges' => [[
                        'node' => [
                            'id' => 'gid://shopify/ProductVariant/8001',
                            'title' => 'Default Title',
                            'sku' => 'CAP-01',
                            'barcode' => '622000111',
                            'price' => '180.00',
                            'compareAtPrice' => '250.00',
                            'selectedOptions' => [['name' => 'Title', 'value' => 'Default Title']],
                            'inventoryItem' => [
                                'id' => 'gid://shopify/InventoryItem/9001',
                                'tracked' => true,
                                'inventoryLevels' => ['nodes' => [
                                    ['location' => ['id' => 'gid://shopify/Location/101'], 'quantities' => [['quantity' => 12]]],
                                    ['location' => ['id' => 'gid://shopify/Location/102'], 'quantities' => [['quantity' => 8]]],
                                ]],
                            ],
                        ],
                    ]]],
                ],
                [
                    'id' => 'gid://shopify/Product/7002',
                    'title' => 'تيشيرت بولو',
                    'productType' => 'ملابس',
                    'hasOnlyDefaultVariant' => false,
                    'featuredMedia' => ['preview' => ['image' => ['url' => 'https://cdn.shopify.com/polo.jpg']]],
                    'variants' => ['edges' => [
                        ['node' => [
                            'id' => 'gid://shopify/ProductVariant/8002',
                            'title' => 'L / أسود',
                            'sku' => 'POLO-L-BLK',
                            'barcode' => null,
                            'price' => '450.00',
                            'compareAtPrice' => '400.00', // smaller than price -> regular_price falls back to 450
                            'selectedOptions' => [['name' => 'Size', 'value' => 'L'], ['name' => 'Color', 'value' => 'أسود']],
                            'inventoryItem' => [
                                'id' => 'gid://shopify/InventoryItem/9002',
                                'tracked' => true,
                                'inventoryLevels' => ['nodes' => [
                                    ['location' => ['id' => 'gid://shopify/Location/101'], 'quantities' => [['quantity' => 5]]],
                                ]],
                            ],
                        ]],
                    ]],
                ],
            ],
        ]);
        $this->app->instance(ShopifyGraphqlClientInterface::class, $mock);

        $result = app(ShopifyProductImportService::class)->importProducts($this->owner, $this->integration, true);

        $this->assertSame(2, $result['imported']);
        $cap = Product::where('shopify_product_id', 7001)->firstOrFail();
        $this->assertSame(ProductType::STANDARD->value, $cap->type);
        $this->assertSame(180.0, (float) $cap->sale_price);
        $this->assertSame(250.0, (float) $cap->regular_price);
        $this->assertSame(9001, $cap->shopify_inventory_item_id);
        $this->assertSame(20.0, (float) $cap->quantity);
        $this->assertSame(12.0, (float) BranchStock::where('branch_id', $this->mainBranch->id)->where('product_id', $cap->id)->value('quantity'));
        $this->assertSame(8.0, (float) BranchStock::where('branch_id', $this->nasrBranch->id)->where('product_id', $cap->id)->value('quantity'));

        $polo = Product::where('shopify_product_id', 7002)->firstOrFail();
        $this->assertSame(ProductType::VARIABLE->value, $polo->type);
        $var = ProductVariant::where('shopify_variant_id', 8002)->firstOrFail();
        $this->assertSame('L', $var->size);
        $this->assertSame('أسود', $var->color);
        $this->assertSame(450.0, (float) $var->sale_price);
        $this->assertSame(450.0, (float) $var->regular_price);
        $this->assertSame(9002, $var->shopify_inventory_item_id);
    }

    public function test_update_preserves_existing_cost_price_and_matches_by_sku_without_duplication(): void
    {
        $existing = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'حذاء رياضي محلي',
            'code' => 'SHOE-1',
            'barcode' => 'SHOE-1',
            'purchase_price' => 320.00,
            'sale_price' => 500.00,
            'quantity' => 10,
            'unit' => 'قطعة',
            'type' => ProductType::STANDARD->value,
        ]);
        BranchStock::create(['branch_id' => $this->mainBranch->id, 'product_id' => $existing->id, 'quantity' => 10]);

        $mock = Mockery::mock(ShopifyGraphqlClientInterface::class);
        $mock->shouldReceive('getProductsPage')->once()->andReturn([
            'has_next_page' => false,
            'end_cursor' => null,
            'products' => [[
                'id' => 'gid://shopify/Product/7777',
                'title' => 'حذاء رياضي محدث',
                'productType' => 'أحذية',
                'hasOnlyDefaultVariant' => true,
                'variants' => ['edges' => [[
                    'node' => [
                        'id' => 'gid://shopify/ProductVariant/8777',
                        'title' => 'Default Title',
                        'sku' => 'SHOE-1',
                        'price' => '550.00',
                        'compareAtPrice' => '650.00',
                        'inventoryItem' => ['id' => 'gid://shopify/InventoryItem/9777', 'tracked' => true, 'inventoryLevels' => ['nodes' => [
                            ['location' => ['id' => 'gid://shopify/Location/101'], 'quantities' => [['quantity' => 99]]],
                        ]]],
                    ],
                ]]],
            ]],
        ]);
        $this->app->instance(ShopifyGraphqlClientInterface::class, $mock);

        $res = app(ShopifyProductImportService::class)->importProducts($this->owner, $this->integration, true);

        $this->assertSame(1, $res['updated']);
        $this->assertSame(1, Product::where('user_id', $this->owner->id)->count());
        $existing->refresh();
        $this->assertSame(320.0, (float) $existing->purchase_price);
        $this->assertSame(550.0, (float) $existing->sale_price);
        $this->assertSame(650.0, (float) $existing->regular_price);
        $this->assertSame(7777, $existing->shopify_product_id);
        $this->assertSame(10.0, (float) BranchStock::where('branch_id', $this->mainBranch->id)->where('product_id', $existing->id)->value('quantity'));
    }

    public function test_import_products_endpoint_queues_cursor_job_when_async(): void
    {
        config(['queue.default' => 'database']);
        Queue::fake();

        $this->actingAs($this->owner)->postJson('/api/shopify/import-products', ['import_stock' => true])
            ->assertStatus(202)
            ->assertJsonPath('queued', true);

        Queue::assertPushed(ImportShopifyProductsPageJob::class);
    }
}
