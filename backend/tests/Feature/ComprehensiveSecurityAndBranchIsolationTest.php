<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\EcommercePlatform;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\ProductType;
use App\Enums\ShiftStatus;
use App\Enums\StockTransferStatus;
use App\Enums\SubscriptionStatus;
use App\Enums\TreasuryType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Contracts\ShopifyGraphqlClientInterface;
use App\Jobs\PushStockToShopifyJob;
use App\Jobs\PushStockToWooCommerceJob;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\OnlineOrder;
use App\Models\OnlineOrderItem;
use App\Models\Party;
use App\Models\Product;
use App\Models\Shift;
use App\Models\ShopifyIntegration;
use App\Models\ShopifyLocationMapping;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\Subscription;
use App\Models\Treasury;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\ProductImageService;
use App\Services\Shopify\ShopifyProductImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

class ComprehensiveSecurityAndBranchIsolationTest extends TestCase
{
    use RefreshDatabase;

    private User $ownerA;
    private User $ownerB;
    private Branch $branchA1;
    private Branch $branchA2;
    private Branch $branchB1;
    private Product $productA;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ownerA = $this->createStoreOwner('01020000001', true);
        $this->ownerB = $this->createStoreOwner('01030000001', false);

        $this->branchA1 = $this->createBranch($this->ownerA, 'فرع A1 الرئيسي', 'BR-A1', true);
        $this->branchA2 = $this->createBranch($this->ownerA, 'فرع A2 الفرعي', 'BR-A2', false);
        $this->branchB1 = $this->createBranch($this->ownerB, 'فرع متجر B', 'BR-B1', true);

        $this->productA = Product::create([
            'user_id' => $this->ownerA->id,
            'name' => 'تيشيرت قطن',
            'code' => 'SKU-COT-1',
            'barcode' => '622000111001',
            'type' => ProductType::STANDARD->value,
            'purchase_price' => 100,
            'regular_price' => 250,
            'sale_price' => 250,
            'quantity' => 50,
            'min_quantity' => 5,
            'unit' => 'قطعة',
        ]);

        BranchStock::create(['branch_id' => $this->branchA1->id, 'product_id' => $this->productA->id, 'quantity' => 20]);
        BranchStock::create(['branch_id' => $this->branchA2->id, 'product_id' => $this->productA->id, 'quantity' => 30]);
    }

    private function createStoreOwner(string $phone, bool $ecommerceEnabled): User
    {
        $owner = User::factory()->create([
            'role' => UserRole::OWNER->value,
            'phone' => $phone,
            'owner_id' => null,
            'status' => UserStatus::ACTIVE->value,
            'ecommerce_enabled' => $ecommerceEnabled,
        ]);

        Subscription::create([
            'user_id' => $owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => SubscriptionStatus::ACTIVE->value,
            'plan' => 'PRO',
        ]);

        return $owner;
    }

    private function createBranch(User $owner, string $name, string $code, bool $isMain): Branch
    {
        return Branch::create([
            'user_id' => $owner->id,
            'name' => $name,
            'code' => $code,
            'type' => BranchType::STORE->value,
            'is_main' => $isMain,
            'is_active' => true,
        ]);
    }

    private function createStaff(User $owner, UserRole $role, ?Branch $branch, string $phone): User
    {
        return User::factory()->create([
            'owner_id' => $owner->id,
            'branch_id' => $branch?->id,
            'role' => $role->value,
            'phone' => $phone,
            'status' => UserStatus::ACTIVE->value,
        ]);
    }

    private function createTreasury(User $owner, TreasuryType $type, ?Branch $branch = null, ?User $assignee = null, float $balance = 0): Treasury
    {
        return Treasury::create([
            'user_id' => $owner->id,
            'branch_id' => $branch?->id,
            'assigned_user_id' => $assignee?->id,
            'name' => "خزينة {$type->value} " . uniqid(),
            'type' => $type->value,
            'balance' => $balance,
            'is_active' => true,
        ]);
    }

    public function test_cross_tenant_shift_settlement_rejects_foreign_treasury_with_422(): void
    {
        $cashierA1 = $this->createStaff($this->ownerA, UserRole::CASHIER, $this->branchA1, '01020000010');
        $drawerA1 = $this->createTreasury($this->ownerA, TreasuryType::CASHIER_DRAWER, $this->branchA1, $cashierA1, 500);
        $treasuryB = $this->createTreasury($this->ownerB, TreasuryType::MAIN, $this->branchB1, null, 1000);

        $shift = Shift::create([
            'user_id' => $this->ownerA->id,
            'created_by' => $cashierA1->id,
            'treasury_id' => $drawerA1->id,
            'shift_number' => 'SH-CT-001',
            'status' => ShiftStatus::CLOSED->value,
            'opened_at' => now()->subHours(4),
            'closed_at' => now()->subHour(),
            'opening_balance' => 100,
            'expected_cash' => 500,
            'actual_cash' => 500,
        ]);

        Sanctum::actingAs($this->ownerA);
        $this->postJson("/api/shifts/{$shift->id}/settle", ['target_treasury_id' => $treasuryB->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['target_treasury_id']);

        $this->assertEquals(1000.0, (float) $treasuryB->fresh()->balance);
    }

    public function test_cross_tenant_admin_cannot_delete_foreign_store_employee(): void
    {
        $adminA = $this->createStaff($this->ownerA, UserRole::ADMIN, null, '01020000011');
        $cashierB = $this->createStaff($this->ownerB, UserRole::CASHIER, $this->branchB1, '01030000011');

        Sanctum::actingAs($adminA);
        $this->deleteJson("/api/employees/{$cashierB->id}")->assertStatus(403);

        $this->assertDatabaseHas('users', ['id' => $cashierB->id]);
    }

    public function test_product_image_service_blocks_cross_tenant_local_file_deletion(): void
    {
        Storage::fake('public');
        $tenantBPath = "tenants/{$this->ownerB->id}/products/secret-photo.webp";
        $tenantAPath = "tenants/{$this->ownerA->id}/products/own-photo.webp";
        Storage::disk('public')->put($tenantBPath, 'tenant-b-binary');
        Storage::disk('public')->put($tenantAPath, 'tenant-a-binary');

        $service = app(ProductImageService::class);
        $service->deleteLocalImageIfOwned("/storage/{$tenantBPath}", $this->ownerA->id);
        $service->deleteLocalImageIfOwned("/storage/{$tenantAPath}", $this->ownerA->id);

        Storage::disk('public')->assertExists($tenantBPath);
        Storage::disk('public')->assertMissing($tenantAPath);
    }

    public function test_shopify_webhook_rejects_missing_shop_domain_and_isolates_tenant_context(): void
    {
        ShopifyIntegration::create([
            'user_id' => $this->ownerA->id,
            'shop_domain' => 'store-a.myshopify.com',
            'access_token' => 'shpat_test_123',
            'webhook_secret' => null,
            'is_active' => true,
        ]);

        config(['services.shopify.client_secret' => 'app_secret_xyz']);
        $payload = json_encode(['id' => 999111]);
        $hmac = base64_encode(hash_hmac('sha256', $payload, 'app_secret_xyz', true));

        $this->postJson("/api/webhooks/shopify/{$this->ownerA->id}", ['id' => 999111], [
            'X-Shopify-Hmac-Sha256' => $hmac,
            'X-Shopify-Topic' => 'orders/create',
        ])->assertStatus(401);
    }

    public function test_cashier_and_sales_require_branch_id_when_branches_exist(): void
    {
        Sanctum::actingAs($this->ownerA);

        foreach ([UserRole::CASHIER, UserRole::SALES] as $idx => $role) {
            $this->postJson('/api/employees', [
                'name' => "موظف {$role->value}",
                'phone' => '010200009' . $idx . '0',
                'password' => 'secret123',
                'role' => $role->value,
            ])->assertStatus(422)->assertJsonValidationErrors(['branch_id']);
        }
    }

    public function test_branch_scoped_roles_are_locked_on_inventory_catalog_opening_balance_and_expenses(): void
    {
        $cashierA1 = $this->createStaff($this->ownerA, UserRole::CASHIER, $this->branchA1, '01020000012');
        $mainTreasury = $this->createTreasury($this->ownerA, TreasuryType::MAIN, null, null, 2000);
        $this->createTreasury($this->ownerA, TreasuryType::CASHIER_DRAWER, $this->branchA1, $cashierA1, 300);

        Sanctum::actingAs($cashierA1);
        $catalog = $this->getJson("/api/products/pos-catalog?branch_id={$this->branchA2->id}")->assertOk();
        $this->assertEquals(20.0, (float) $catalog->json('data.0.quantity'));

        $detail = $this->getJson("/api/products/{$this->productA->id}?branch_id={$this->branchA2->id}")->assertOk();
        $this->assertEquals(20.0, (float) $detail->json('data.quantity'));

        $this->postJson('/api/products/opening-balance', [
            'product_id' => $this->productA->id,
            'branch_id' => $this->branchA2->id,
            'quantity' => 5,
            'purchase_price' => 100,
        ])->assertStatus(403);

        $exp = $this->postJson('/api/expenses', [
            'title' => 'نثريات',
            'amount' => 40,
            'payment_method' => PaymentMethod::CASH->value,
            'treasury_id' => $mainTreasury->id,
            'date' => now()->toDateString(),
        ])->assertStatus(201);

        $this->assertNotEquals($mainTreasury->id, $exp->json('data.treasury_id'));
        $this->assertEquals(2000.0, (float) $mainTreasury->fresh()->balance);
    }

    public function test_non_owner_roles_and_sales_restricted_from_sensitive_treasuries_and_cross_branch_shifts(): void
    {
        $salesA1 = $this->createStaff($this->ownerA, UserRole::SALES, $this->branchA1, '01020000013');
        $managerA1 = $this->createStaff($this->ownerA, UserRole::MANAGER, $this->branchA1, '01020000014');
        $cashierA2 = $this->createStaff($this->ownerA, UserRole::CASHIER, $this->branchA2, '01020000015');

        $mainTreasury = $this->createTreasury($this->ownerA, TreasuryType::MAIN, null, null, 1500);
        $treasuryA2 = $this->createTreasury($this->ownerA, TreasuryType::BRANCH_SAFE, $this->branchA2, null, 900);
        $drawerA2 = $this->createTreasury($this->ownerA, TreasuryType::CASHIER_DRAWER, $this->branchA2, $cashierA2, 400);

        $shiftA2 = Shift::create([
            'user_id' => $this->ownerA->id,
            'created_by' => $cashierA2->id,
            'treasury_id' => $drawerA2->id,
            'shift_number' => 'SH-A2-99',
            'status' => ShiftStatus::CLOSED->value,
            'opened_at' => now()->subHours(2),
            'closed_at' => now()->subMinute(),
            'opening_balance' => 100,
            'expected_cash' => 400,
            'actual_cash' => 400,
        ]);

        Sanctum::actingAs($salesA1);
        $this->getJson('/api/treasuries')->assertStatus(403);

        Sanctum::actingAs($managerA1);
        $this->getJson("/api/treasuries/{$mainTreasury->id}")->assertStatus(403);
        $this->getJson("/api/treasuries/{$treasuryA2->id}")->assertStatus(403);
        $this->getJson("/api/shifts/{$shiftA2->id}")->assertStatus(403);
        $this->postJson("/api/shifts/{$shiftA2->id}/settle", ['target_treasury_id' => $treasuryA2->id])->assertStatus(403);
    }

    public function test_branch_manager_isolated_on_transfers_online_orders_couriers_and_reports(): void
    {
        $managerA1 = $this->createStaff($this->ownerA, UserRole::MANAGER, $this->branchA1, '01020000016');
        $salesA1 = $this->createStaff($this->ownerA, UserRole::SALES, $this->branchA1, '01020000017');
        $courier = Party::create(['user_id' => $this->ownerA->id, 'name' => 'أرامكس', 'type' => PartyType::COURIER->value, 'balance' => 400]);

        $transferA1ToA2 = StockTransfer::create([
            'user_id' => $this->ownerA->id,
            'created_by' => $managerA1->id,
            'from_branch_id' => $this->branchA1->id,
            'to_branch_id' => $this->branchA2->id,
            'transfer_number' => 'TRF-1001',
            'status' => StockTransferStatus::IN_TRANSIT->value,
            'notes' => 'test',
        ]);
        StockTransferItem::create(['stock_transfer_id' => $transferA1ToA2->id, 'product_id' => $this->productA->id, 'quantity_sent' => 2]);

        $orderA2 = OnlineOrder::create([
            'user_id' => $this->ownerA->id,
            'platform' => EcommercePlatform::WOOCOMMERCE->value,
            'external_order_id' => 'WC-800',
            'branch_id' => $this->branchA2->id,
            'courier_party_id' => $courier->id,
            'status' => WcOrderStatus::CONFIRMED->value,
            'payment_status' => WcPaymentStatus::PENDING_COD->value,
            'total' => 250,
            'date' => now(),
        ]);

        Sanctum::actingAs($managerA1);
        $this->postJson("/api/stock-transfers/{$transferA1ToA2->id}/receive")->assertStatus(403);
        $this->postJson("/api/online-orders/{$orderA2->id}/confirm", ['branch_id' => $this->branchA2->id])->assertStatus(403);
        $this->postJson("/api/online-orders/{$orderA2->id}/cancel", ['reason' => 'CUSTOMER_REJECTED'])->assertStatus(403);
        $this->assertEquals(0, $this->getJson("/api/couriers/{$courier->id}/manifest?branch_id={$this->branchA2->id}")->assertOk()->json('metrics.total_shipments'));

        $stockQtyInA1Report = collect($this->getJson("/api/reports/stock?branch_id={$this->branchA2->id}")->assertOk()->json('data.products'))->first()['quantity'];
        $this->assertEquals(20.0, (float) $stockQtyInA1Report);

        Sanctum::actingAs($salesA1);
        $this->postJson("/api/couriers/{$courier->id}/settle", ['amount' => 100])->assertStatus(403);
    }

    public function test_general_ops_manager_and_supervisor_access_all_branches_while_blocked_from_profits(): void
    {
        $generalManager = $this->createStaff($this->ownerA, UserRole::MANAGER, null, '01020000018');
        $generalSupervisor = $this->createStaff($this->ownerA, UserRole::SUPERVISOR, null, '01020000019');
        $mainTreasury = $this->createTreasury($this->ownerA, TreasuryType::MAIN, null, null, 3000);

        Sanctum::actingAs($generalManager);
        $this->assertEquals(30.0, (float) $this->getJson("/api/products/pos-catalog?branch_id={$this->branchA2->id}")->assertOk()->json('data.0.quantity'));
        $this->getJson('/api/reports/profit')->assertStatus(403);
        $this->getJson("/api/treasuries/{$mainTreasury->id}")->assertStatus(403);

        Sanctum::actingAs($generalSupervisor);
        $this->assertEquals(20.0, (float) $this->getJson("/api/products/pos-catalog?branch_id={$this->branchA1->id}")->assertOk()->json('data.0.quantity'));
        $this->getJson('/api/reports/profit')->assertStatus(403);
    }

    public function test_cashier_branch_transfer_blocks_unsettled_shifts_syncs_treasury_and_revokes_tokens(): void
    {
        $cashier = $this->createStaff($this->ownerA, UserRole::CASHIER, $this->branchA1, '01020000020');
        $drawer = $this->createTreasury($this->ownerA, TreasuryType::CASHIER_DRAWER, $this->branchA1, $cashier, 100);
        $cashier->createToken('old-device');

        $shift = Shift::create([
            'user_id' => $this->ownerA->id,
            'created_by' => $cashier->id,
            'treasury_id' => $drawer->id,
            'shift_number' => 'SH-XFER-1',
            'status' => ShiftStatus::OPEN->value,
            'opened_at' => now(),
            'opening_balance' => 100,
        ]);

        Sanctum::actingAs($this->ownerA);
        $this->putJson("/api/employees/{$cashier->id}", [
            'name' => $cashier->name,
            'phone' => $cashier->phone,
            'role' => UserRole::CASHIER->value,
            'branch_id' => $this->branchA2->id,
        ])->assertStatus(422)->assertJsonPath('error_code', 'OPEN_SHIFT_TRANSFER_BLOCKED');

        $shift->update(['status' => ShiftStatus::SETTLED->value, 'settled_at' => now(), 'settled_by' => $this->ownerA->id]);

        $this->putJson("/api/employees/{$cashier->id}", [
            'name' => $cashier->name,
            'phone' => $cashier->phone,
            'role' => UserRole::CASHIER->value,
            'branch_id' => $this->branchA2->id,
        ])->assertOk();

        $this->assertEquals($this->branchA2->id, $cashier->fresh()->branch_id);
        $this->assertEquals($this->branchA2->id, $drawer->fresh()->branch_id);
        $this->assertEquals(0, $cashier->tokens()->count());
    }

    public function test_ecommerce_branch_clearing_soft_deleted_guards_and_inactive_location_isolation(): void
    {
        Sanctum::actingAs($this->ownerA);

        $woo = WooCommerceIntegration::create([
            'user_id' => $this->ownerA->id,
            'store_url' => 'https://example-shop.com',
            'consumer_key' => 'ck_1',
            'consumer_secret' => 'cs_1',
            'online_branch_id' => $this->branchA2->id,
            'is_active' => true,
        ]);
        $this->postJson('/api/woocommerce/settings', [
            'store_url' => 'https://example-shop.com',
            'online_branch_id' => null,
            'is_active' => true,
        ])->assertOk();
        $this->assertNull($woo->fresh()->online_branch_id);

        $tempBranch = $this->createBranch($this->ownerA, 'فرع مؤقت للحذف', 'BR-TMP', false);
        $shopify = ShopifyIntegration::create([
            'user_id' => $this->ownerA->id,
            'shop_domain' => 'clean-shop.myshopify.com',
            'access_token' => 'shpat_clean',
            'default_branch_id' => $tempBranch->id,
            'is_active' => true,
        ]);
        ShopifyLocationMapping::create([
            'user_id' => $this->ownerA->id,
            'shopify_integration_id' => $shopify->id,
            'shopify_location_id' => '7001',
            'shopify_location_name' => 'Inactive Loc',
            'branch_id' => $tempBranch->id,
            'is_active' => false,
        ]);

        $this->deleteJson("/api/branches/{$tempBranch->id}")->assertOk();
        $this->assertNull($shopify->fresh()->default_branch_id);
        $this->assertDatabaseHas('shopify_location_mappings', [
            'shopify_location_id' => '7001',
            'branch_id' => null,
            'is_active' => false,
        ]);
    }

    public function test_stock_transfer_receive_and_online_order_creation_trigger_ecommerce_stock_sync(): void
    {
        Queue::fake();

        WooCommerceIntegration::create([
            'user_id' => $this->ownerA->id,
            'store_url' => 'https://sync-test.example.com',
            'consumer_key' => 'ck_1',
            'consumer_secret' => 'cs_1',
            'online_branch_id' => $this->branchA2->id,
            'auto_sync_stock' => true,
            'is_active' => true,
        ]);
        $shopify = ShopifyIntegration::create([
            'user_id' => $this->ownerA->id,
            'shop_domain' => 'sync-shop.myshopify.com',
            'access_token' => 'shpat_sync',
            'default_branch_id' => $this->branchA2->id,
            'auto_sync_stock' => true,
            'is_active' => true,
        ]);
        ShopifyLocationMapping::create([
            'user_id' => $this->ownerA->id,
            'shopify_integration_id' => $shopify->id,
            'shopify_location_id' => '8001',
            'shopify_location_name' => 'Main Loc',
            'branch_id' => $this->branchA2->id,
            'is_active' => true,
        ]);

        $this->productA->update(['wc_product_id' => 5001, 'shopify_product_id' => '9001']);

        $transfer = StockTransfer::create([
            'user_id' => $this->ownerA->id,
            'created_by' => $this->ownerA->id,
            'from_branch_id' => $this->branchA1->id,
            'to_branch_id' => $this->branchA2->id,
            'transfer_number' => 'TRF-SYNC-1',
            'status' => StockTransferStatus::IN_TRANSIT->value,
        ]);
        StockTransferItem::create(['stock_transfer_id' => $transfer->id, 'product_id' => $this->productA->id, 'quantity_sent' => 4]);

        Sanctum::actingAs($this->ownerA);
        $this->postJson("/api/stock-transfers/{$transfer->id}/receive")->assertOk();

        Queue::assertPushed(PushStockToWooCommerceJob::class);
        Queue::assertPushed(PushStockToShopifyJob::class);

        $productSync2 = Product::create([
            'user_id' => $this->ownerA->id,
            'name' => 'بنطلون شيك',
            'code' => 'SKU-PANT-2',
            'barcode' => '622000111002',
            'type' => ProductType::STANDARD->value,
            'purchase_price' => 120,
            'regular_price' => 300,
            'sale_price' => 300,
            'quantity' => 15,
            'wc_product_id' => 5002,
        ]);

        app(\App\Services\OnlineOrders\OnlineOrderIngestionService::class)->ingest(
            $this->ownerA,
            EcommercePlatform::WOOCOMMERCE,
            [
                'id' => 9901,
                'status' => 'processing',
                'total' => '300.00',
                'subtotal' => '300.00',
                'billing' => ['first_name' => 'أحمد', 'last_name' => 'علي', 'phone' => '01099887766'],
                'line_items' => [[
                    'product_id' => 5002,
                    'name' => $productSync2->name,
                    'quantity' => 2,
                    'price' => 150,
                    'total' => '300.00',
                ]],
            ]
        );
        Queue::assertPushed(PushStockToWooCommerceJob::class, fn (PushStockToWooCommerceJob $job) => $job->productId === $productSync2->id);

        $mockClient = Mockery::mock(ShopifyGraphqlClientInterface::class);
        $mockClient->shouldReceive('getProductsPage')->once()->andReturn([
            'products' => [[
                'id' => 'gid://shopify/Product/9002',
                'title' => 'Imported Inactive Loc Item',
                'status' => 'ACTIVE',
                'variants' => ['edges' => [['node' => [
                    'id' => 'gid://shopify/ProductVariant/900201',
                    'sku' => 'INACTIVE-LOC-1',
                    'price' => '120',
                    'inventoryItem' => ['id' => 'gid://shopify/InventoryItem/7', 'inventoryLevels' => ['edges' => [[
                        'node' => ['location' => ['id' => 'gid://shopify/Location/9999'], 'quantities' => [['name' => 'available', 'quantity' => 9]]],
                    ]]]],
                ]]]],
            ]],
            'has_next_page' => false,
            'end_cursor' => null,
        ]);
        ShopifyLocationMapping::create([
            'user_id' => $this->ownerA->id,
            'shopify_integration_id' => $shopify->id,
            'shopify_location_id' => '9999',
            'shopify_location_name' => 'Disabled Loc',
            'branch_id' => $this->branchA1->id,
            'is_active' => false,
        ]);
        $this->app->instance(ShopifyGraphqlClientInterface::class, $mockClient);

        $res = app(ShopifyProductImportService::class)->importPage($this->ownerA, $shopify, null, 25, true);
        $this->assertEquals(1, $res['imported']);
        $imported = Product::where('shopify_product_id', '9002')->firstOrFail();
        $this->assertEquals(0.0, (float) BranchStock::where('product_id', $imported->id)->sum('quantity'));
    }
}
