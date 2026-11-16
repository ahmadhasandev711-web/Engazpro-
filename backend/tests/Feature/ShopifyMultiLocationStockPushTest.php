<?php

namespace Tests\Feature;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\ProductType;
use App\Enums\ShopifyAuthMode;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Enums\WcOrderStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShopifyIntegration;
use App\Models\ShopifyLocationMapping;
use App\Models\ShopifyOrder;
use App\Models\ShopifyOrderItem;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Shopify\ShopifyStockSyncGate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class ShopifyMultiLocationStockPushTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $mainBranch;
    protected Branch $nasrBranch;
    protected ShopifyIntegration $integration;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => UserRole::OWNER->value]);
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
            'shop_domain' => 'stock-sync.myshopify.com',
            'auth_mode' => ShopifyAuthMode::ACCESS_TOKEN,
            'access_token' => 'shpat_stock',
            'auto_sync_stock' => true,
            'is_active' => true,
        ]);

        ShopifyLocationMapping::create([
            'user_id' => $this->owner->id,
            'shopify_integration_id' => $this->integration->id,
            'shopify_location_id' => 101,
            'shopify_location_name' => 'Main Loc',
            'branch_id' => $this->mainBranch->id,
            'auto_sync_stock' => true,
            'is_active' => true,
        ]);
        ShopifyLocationMapping::create([
            'user_id' => $this->owner->id,
            'shopify_integration_id' => $this->integration->id,
            'shopify_location_id' => 102,
            'shopify_location_name' => 'Nasr Loc',
            'branch_id' => $this->nasrBranch->id,
            'auto_sync_stock' => true,
            'is_active' => true,
        ]);
        ShopifyStockSyncGate::forget($this->owner->id);
    }

    public function test_branch_stock_observer_pushes_net_quantity_for_specific_mapped_location(): void
    {
        $pushedPayloads = [];
        $mock = Mockery::mock(ShopifyGraphqlClientInterface::class);
        $mock->shouldReceive('setInventoryQuantities')->andReturnUsing(function ($int, $quantities) use (&$pushedPayloads) {
            $pushedPayloads[] = $quantities;

            return ['inventoryAdjustmentGroup' => ['reason' => 'correction'], 'userErrors' => []];
        });
        $this->app->instance(ShopifyGraphqlClientInterface::class, $mock);

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'سماعة بلوتوث',
            'purchase_price' => 100,
            'sale_price' => 200,
            'quantity' => 20,
            'unit' => 'قطعة',
            'type' => ProductType::STANDARD->value,
            'shopify_product_id' => 5001,
            'shopify_variant_id' => 6001,
            'shopify_inventory_item_id' => 7001,
        ]);

        $order = ShopifyOrder::create([
            'user_id' => $this->owner->id,
            'shopify_order_id' => 8801,
            'branch_id' => $this->mainBranch->id,
            'status' => WcOrderStatus::CONFIRMED,
            'total' => 600,
        ]);
        ShopifyOrderItem::create([
            'user_id' => $this->owner->id,
            'shopify_order_id' => $order->id,
            'product_id' => $product->id,
            'shopify_product_id' => 5001,
            'shopify_variant_id' => 6001,
            'quantity' => 3,
        ]);

        BranchStock::create(['branch_id' => $this->mainBranch->id, 'product_id' => $product->id, 'quantity' => 20]);

        $this->assertNotEmpty($pushedPayloads);
        $entry = $pushedPayloads[0][0];
        $this->assertSame('gid://shopify/InventoryItem/7001', $entry['inventoryItemId']);
        $this->assertSame('gid://shopify/Location/101', $entry['locationId']);
        $this->assertSame(17, $entry['quantity']); // 20 - 3 reserved on Main branch
        $this->assertNull($entry['changeFromQuantity']);
    }

    public function test_push_all_stocks_pushes_variable_product_across_all_mapped_locations(): void
    {
        $pushedEntries = [];
        $mock = Mockery::mock(ShopifyGraphqlClientInterface::class);
        $mock->shouldReceive('setInventoryQuantities')->once()->andReturnUsing(function ($int, $quantities) use (&$pushedEntries) {
            $pushedEntries = $quantities;

            return ['inventoryAdjustmentGroup' => ['reason' => 'correction'], 'userErrors' => []];
        });
        $this->app->instance(ShopifyGraphqlClientInterface::class, $mock);

        $product = Product::withoutEvents(fn () => Product::create([
            'user_id' => $this->owner->id,
            'name' => 'جاكيت شتوي',
            'purchase_price' => 400,
            'sale_price' => 800,
            'quantity' => 15,
            'unit' => 'قطعة',
            'type' => ProductType::VARIABLE->value,
            'has_variants' => true,
            'shopify_product_id' => 5010,
        ]));
        $variant = ProductVariant::create([
            'user_id' => $this->owner->id,
            'product_id' => $product->id,
            'name' => 'XL',
            'purchase_price' => 400,
            'sale_price' => 800,
            'quantity' => 15,
            'shopify_variant_id' => 6010,
            'shopify_inventory_item_id' => 7010,
        ]);

        BranchStock::withoutEvents(function () use ($product, $variant) {
            BranchStock::create(['branch_id' => $this->mainBranch->id, 'product_id' => $product->id, 'product_variant_id' => $variant->id, 'quantity' => 10]);
            BranchStock::create(['branch_id' => $this->nasrBranch->id, 'product_id' => $product->id, 'product_variant_id' => $variant->id, 'quantity' => 5]);
        });

        config(['queue.default' => 'sync']);
        $res = $this->actingAs($this->owner)->postJson('/api/shopify/push-all-stocks');
        $res->assertOk()->assertJsonPath('data.synced_count', 1);

        $this->assertCount(2, $pushedEntries);
        $byLoc = collect($pushedEntries)->keyBy('locationId');
        $this->assertSame(10, $byLoc['gid://shopify/Location/101']['quantity']);
        $this->assertSame(5, $byLoc['gid://shopify/Location/102']['quantity']);
    }
}
