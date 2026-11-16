<?php

namespace Tests\Feature;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\ProductType;
use App\Enums\ShopifyAuthMode;
use App\Enums\StockAdjustmentMode;
use App\Enums\StockMovementSource;
use App\Enums\StockMovementType;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ShopifyIntegration;
use App\Models\ShopifyLocationMapping;
use App\Models\StockMovement;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Shopify\ShopifyStockSyncGate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class StockAdjustmentAndMovementsTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $manager;
    protected Branch $mainBranch;
    protected Branch $otherBranch;
    protected Product $product;

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
        $this->otherBranch = Branch::create(['user_id' => $this->owner->id, 'name' => 'فرع المعادي', 'code' => 'BR-2', 'is_active' => true]);
        $this->manager = User::factory()->create(['owner_id' => $this->owner->id, 'branch_id' => $this->mainBranch->id, 'role' => UserRole::MANAGER->value]);

        $this->product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'ماوس لاسلكي',
            'code' => 'MS-1',
            'purchase_price' => 120,
            'sale_price' => 250,
            'quantity' => 20,
            'min_quantity' => 5,
            'unit' => 'قطعة',
            'type' => ProductType::STANDARD->value,
            'shopify_product_id' => 3001,
            'shopify_variant_id' => 4001,
            'shopify_inventory_item_id' => 5001,
        ]);
        BranchStock::create(['branch_id' => $this->mainBranch->id, 'product_id' => $this->product->id, 'quantity' => 20, 'min_quantity' => 5]);
    }

    public function test_stock_adjustment_records_movement_updates_branch_and_triggers_shopify_push(): void
    {
        $integration = ShopifyIntegration::create([
            'user_id' => $this->owner->id, 'shop_domain' => 'adj-shop.myshopify.com',
            'auth_mode' => ShopifyAuthMode::ACCESS_TOKEN, 'access_token' => 'shpat_adj',
            'auto_sync_stock' => true, 'is_active' => true,
        ]);
        ShopifyLocationMapping::create([
            'user_id' => $this->owner->id, 'shopify_integration_id' => $integration->id,
            'shopify_location_id' => 777, 'shopify_location_name' => 'Main',
            'branch_id' => $this->mainBranch->id, 'auto_sync_stock' => true, 'is_active' => true,
        ]);
        ShopifyStockSyncGate::forget($this->owner->id);

        $mock = Mockery::mock(ShopifyGraphqlClientInterface::class);
        $mock->shouldReceive('setInventoryQuantities')->once()->withArgs(function ($int, $quantities) {
            return $quantities[0]['quantity'] === 16 && $quantities[0]['locationId'] === 'gid://shopify/Location/777';
        })->andReturn(['inventoryAdjustmentGroup' => ['reason' => 'correction'], 'userErrors' => []]);
        $this->app->instance(ShopifyGraphqlClientInterface::class, $mock);

        // SET_ACTUAL 20 -> 16 creates OUT adjustment of 4
        $res = $this->actingAs($this->owner)->postJson('/api/stock/adjust', [
            'branch_id' => $this->mainBranch->id,
            'product_id' => $this->product->id,
            'mode' => StockAdjustmentMode::SET_ACTUAL->value,
            'quantity' => 16,
            'reason' => 'جرد نهاية الشهر - تالف 4 قطع',
        ]);

        $res->assertOk()->assertJsonPath('data.adjusted', true)->assertJsonPath('data.new_quantity', 16);
        $this->assertSame(16.0, (float) $this->product->fresh()->quantity);

        $movement = StockMovement::latest('id')->firstOrFail();
        $this->assertSame(StockMovementType::OUT->value, $movement->type);
        $this->assertSame(StockMovementSource::ADJUSTMENT->value, $movement->source_type);
        $this->assertSame(4.0, (float) $movement->quantity);
    }

    public function test_manager_cannot_adjust_other_branch_and_movements_ledger_is_filterable(): void
    {
        $this->actingAs($this->manager)->postJson('/api/stock/adjust', [
            'branch_id' => $this->otherBranch->id,
            'product_id' => $this->product->id,
            'mode' => StockAdjustmentMode::INCREASE->value,
            'quantity' => 3,
            'reason' => 'فائض',
        ])->assertStatus(403);

        $this->actingAs($this->owner)->postJson('/api/stock/adjust', [
            'branch_id' => $this->mainBranch->id,
            'product_id' => $this->product->id,
            'mode' => StockAdjustmentMode::INCREASE->value,
            'quantity' => 5,
            'reason' => 'تعديل فحص',
        ])->assertOk();

        $movRes = $this->actingAs($this->owner)->getJson('/api/stock/movements?source_type=' . StockMovementSource::ADJUSTMENT->value);
        $movRes->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.quantity', 5);
    }
}
