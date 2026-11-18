<?php

namespace Tests\Feature;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\EcommercePlatform;
use App\Enums\ProductType;
use App\Enums\ShopifyAuthMode;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Enums\WcOrderStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\OnlineOrder;
use App\Models\OnlineOrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShopifyIntegration;
use App\Models\ShopifyLocationMapping;
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

        $order = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::SHOPIFY,
            'external_order_id' => '8801',
            'external_order_number' => '#8801',
            'branch_id' => $this->mainBranch->id,
            'status' => WcOrderStatus::CONFIRMED,
            'total' => 600,
        ]);
        OnlineOrderItem::create([
            'user_id' => $this->owner->id,
            'online_order_id' => $order->id,
            'product_id' => $product->id,
            'external_product_id' => '5001',
            'external_variant_id' => '6001',
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

    public function test_activates_inventory_and_retries_with_fresh_idempotency_key_when_not_stocked(): void
    {
        $usedKeys = [];
        $calls = 0;
        $mock = Mockery::mock(ShopifyGraphqlClientInterface::class);
        $mock->shouldReceive('setInventoryQuantities')->twice()->andReturnUsing(function ($int, $quantities, $key) use (&$calls, &$usedKeys) {
            $calls++;
            $usedKeys[] = $key;
            if ($calls === 1) {
                throw new \App\Exceptions\ShopifyConnectionException('Not stocked', 422, [['code' => 'ITEM_NOT_STOCKED_AT_LOCATION', 'message' => 'Item not stocked']]);
            }

            return ['inventoryAdjustmentGroup' => ['reason' => 'correction'], 'userErrors' => []];
        });
        $mock->shouldReceive('activateInventory')->once()->withArgs(
            fn ($int, $itemGid, $locGid) => $itemGid === 'gid://shopify/InventoryItem/7050' && $locGid === 'gid://shopify/Location/101'
        )->andReturn(['inventoryLevel' => ['id' => 'gid://shopify/InventoryLevel/1']]);
        $this->app->instance(ShopifyGraphqlClientInterface::class, $mock);

        $product = Product::withoutEvents(fn () => Product::create([
            'user_id' => $this->owner->id, 'name' => 'تيشيرت بيسك', 'purchase_price' => 50, 'sale_price' => 120,
            'quantity' => 7, 'unit' => 'قطعة', 'type' => ProductType::STANDARD->value,
            'shopify_product_id' => 5050, 'shopify_variant_id' => 6050, 'shopify_inventory_item_id' => 7050, 'shopify_tracked' => true,
        ]));
        BranchStock::withoutEvents(fn () => BranchStock::create(['branch_id' => $this->mainBranch->id, 'product_id' => $product->id, 'quantity' => 7]));

        $res = app(\App\Services\Shopify\ShopifyStockPushService::class)->pushProduct($this->integration, $product, $this->mainBranch->id);
        $this->assertSame(1, $res['pushed_entries']);
        $this->assertCount(2, $usedKeys);
        $this->assertNotSame($usedKeys[0], $usedKeys[1]);
    }

    public function test_moving_order_branch_syncs_both_original_and_new_shopify_locations(): void
    {
        $pushedLocations = [];
        $mock = Mockery::mock(ShopifyGraphqlClientInterface::class);
        $mock->shouldReceive('setInventoryQuantities')->andReturnUsing(function ($int, $quantities) use (&$pushedLocations) {
            foreach ($quantities as $q) {
                $pushedLocations[] = $q['locationId'];
            }

            return ['inventoryAdjustmentGroup' => ['reason' => 'correction'], 'userErrors' => []];
        });
        $this->app->instance(ShopifyGraphqlClientInterface::class, $mock);

        $product = Product::withoutEvents(fn () => Product::create([
            'user_id' => $this->owner->id, 'name' => 'بنطلون جينز', 'purchase_price' => 150, 'sale_price' => 350,
            'quantity' => 15, 'unit' => 'قطعة', 'type' => ProductType::STANDARD->value,
            'shopify_product_id' => 5099, 'shopify_variant_id' => 6099, 'shopify_inventory_item_id' => 7099,
        ]));
        BranchStock::withoutEvents(function () use ($product) {
            BranchStock::create(['branch_id' => $this->mainBranch->id, 'product_id' => $product->id, 'quantity' => 10]);
            BranchStock::create(['branch_id' => $this->nasrBranch->id, 'product_id' => $product->id, 'quantity' => 5]);
        });

        $order = OnlineOrder::create([
            'user_id' => $this->owner->id, 'platform' => EcommercePlatform::SHOPIFY, 'external_order_id' => '9911',
            'branch_id' => $this->mainBranch->id, 'status' => WcOrderStatus::PENDING_CONFIRMATION, 'total' => 350,
        ]);
        OnlineOrderItem::create([
            'user_id' => $this->owner->id, 'online_order_id' => $order->id, 'product_id' => $product->id, 'quantity' => 1,
        ]);

        $order->update(['branch_id' => $this->nasrBranch->id]);
        $this->assertContains('gid://shopify/Location/101', $pushedLocations);
        $this->assertContains('gid://shopify/Location/102', $pushedLocations);
    }
}
