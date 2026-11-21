<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\CustomerTier;
use App\Enums\EcommercePlatform;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\ProductType;
use App\Enums\ShiftStatus;
use App\Enums\StockAdjustmentMode;
use App\Enums\StockTransferStatus;
use App\Enums\SubscriptionStatus;
use App\Enums\TreasuryType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Jobs\PushStockToShopifyJob;
use App\Jobs\PushStockToWooCommerceJob;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Category;
use App\Models\OnlineOrder;
use App\Models\OnlineOrderItem;
use App\Models\Party;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Shift;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\Subscription;
use App\Models\Treasury;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RolesPermissionsAndBranchRoutingTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Branch $storeMain;
    private Branch $warehouseSecond;
    private Branch $vanBranch;
    private Branch $inactiveStore;
    private Category $category;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake([PushStockToWooCommerceJob::class, PushStockToShopifyJob::class]);

        $this->owner = User::factory()->create([
            'role' => UserRole::OWNER->value,
            'phone' => '01090000001',
            'status' => UserStatus::ACTIVE->value,
            'ecommerce_enabled' => true,
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => SubscriptionStatus::ACTIVE->value,
            'plan' => 'PRO',
        ]);

        $this->storeMain = $this->createBranch('فرع مدينة نصر', 'BR-MAIN', BranchType::STORE, true, true);
        $this->warehouseSecond = $this->createBranch('مخزن العبور', 'WH-2', BranchType::WAREHOUSE, false, true);
        $this->vanBranch = $this->createBranch('سيارة المندوب 1', 'VAN-1', BranchType::VAN, false, true);
        $this->inactiveStore = $this->createBranch('فرع مغلق', 'BR-OFF', BranchType::STORE, false, false);

        $this->category = Category::create([
            'user_id' => $this->owner->id,
            'name' => 'ملابس رجالي',
        ]);

        $this->product = Product::create([
            'user_id' => $this->owner->id,
            'category_id' => $this->category->id,
            'name' => 'جاكيت شتوي',
            'code' => 'JKT-001',
            'barcode' => '622900000001',
            'type' => ProductType::STANDARD->value,
            'purchase_price' => 420.50,
            'regular_price' => 800,
            'sale_price' => 750,
            'quantity' => 50,
            'min_quantity' => 5,
            'unit' => 'قطعة',
        ]);

        BranchStock::create(['branch_id' => $this->storeMain->id, 'product_id' => $this->product->id, 'quantity' => 3]);
        BranchStock::create(['branch_id' => $this->warehouseSecond->id, 'product_id' => $this->product->id, 'quantity' => 25]);
        BranchStock::create(['branch_id' => $this->vanBranch->id, 'product_id' => $this->product->id, 'quantity' => 40]);
        BranchStock::create(['branch_id' => $this->inactiveStore->id, 'product_id' => $this->product->id, 'quantity' => 99]);
    }

    private function createBranch(string $name, string $code, BranchType $type, bool $isMain, bool $isActive): Branch
    {
        return Branch::create([
            'user_id' => $this->owner->id,
            'name' => $name,
            'code' => $code,
            'type' => $type->value,
            'is_main' => $isMain,
            'is_active' => $isActive,
        ]);
    }

    private function createStaff(UserRole $role, ?Branch $branch, string $phone): User
    {
        return User::factory()->create([
            'owner_id' => $this->owner->id,
            'branch_id' => $branch?->id,
            'role' => $role->value,
            'phone' => $phone,
            'status' => UserStatus::ACTIVE->value,
        ]);
    }

    private function createTreasury(TreasuryType $type, ?Branch $branch = null, ?User $assignee = null, float $balance = 1000): Treasury
    {
        return Treasury::create([
            'user_id' => $this->owner->id,
            'branch_id' => $branch?->id,
            'assigned_user_id' => $assignee?->id,
            'name' => "خزينة {$type->value} " . uniqid(),
            'type' => $type->value,
            'balance' => $balance,
            'is_active' => true,
        ]);
    }

    public function test_cashier_mandob_sales_blocked_from_supplier_courier_edits_crm_tier_supplier_ledger_and_category_delete(): void
    {
        $cashier = $this->createStaff(UserRole::CASHIER, $this->storeMain, '01090000010');
        $mandob = $this->createStaff(UserRole::MANDOB, $this->vanBranch, '01090000011');
        $sales = $this->createStaff(UserRole::SALES, $this->storeMain, '01090000012');

        $customer = Party::create(['user_id' => $this->owner->id, 'name' => 'عميل تجزئة', 'type' => PartyType::CUSTOMER->value, 'balance' => 0]);
        $supplier = Party::create(['user_id' => $this->owner->id, 'name' => 'مصنع النيل', 'type' => PartyType::SUPPLIER->value, 'balance' => 1200]);
        $courier = Party::create(['user_id' => $this->owner->id, 'name' => 'بوسطة', 'type' => PartyType::COURIER->value, 'balance' => 500]);

        foreach ([$cashier, $mandob, $sales] as $restrictedUser) {
            Sanctum::actingAs($restrictedUser);

            $this->putJson("/api/parties/{$supplier->id}", ['name' => 'تعديل غير مصرح', 'type' => PartyType::SUPPLIER->value])->assertStatus(403);
            $this->putJson("/api/parties/{$courier->id}", ['name' => 'تعديل شحن', 'type' => PartyType::COURIER->value])->assertStatus(403);
            $this->patchJson("/api/parties/{$customer->id}/tier", ['tier' => CustomerTier::VIP->value])->assertStatus(403);
            $this->getJson("/api/ledger/{$supplier->id}")->assertStatus(403);
            $this->deleteJson("/api/categories/{$this->category->id}")->assertStatus(403);
        }

        // Cashier keeps operational access to customer edits, customer ledger, and fixing category typos
        Sanctum::actingAs($cashier);
        $this->putJson("/api/parties/{$customer->id}", ['name' => 'عميل معدل', 'type' => PartyType::CUSTOMER->value])->assertOk();
        $this->getJson("/api/ledger/{$customer->id}")->assertOk();
        $this->putJson("/api/categories/{$this->category->id}", ['name' => 'ملابس رجالي محدثة'])->assertOk();
    }

    public function test_supervisor_and_cashier_courier_settlement_vs_sales_mandob_blocks(): void
    {
        $supervisor = $this->createStaff(UserRole::SUPERVISOR, $this->storeMain, '01090000020');
        $cashier = $this->createStaff(UserRole::CASHIER, $this->storeMain, '01090000021');
        $sales = $this->createStaff(UserRole::SALES, $this->storeMain, '01090000022');
        $mandob = $this->createStaff(UserRole::MANDOB, $this->vanBranch, '01090000023');

        $this->createTreasury(TreasuryType::BRANCH_SAFE, $this->storeMain, null, 2000);
        $cashierDrawer = $this->createTreasury(TreasuryType::CASHIER_DRAWER, $this->storeMain, $cashier, 500);
        Shift::create([
            'user_id' => $this->owner->id,
            'created_by' => $cashier->id,
            'treasury_id' => $cashierDrawer->id,
            'shift_number' => 'SH-CASH-1',
            'status' => ShiftStatus::OPEN->value,
            'opened_at' => now(),
            'opening_balance' => 500,
        ]);

        $courier = Party::create(['user_id' => $this->owner->id, 'name' => 'أرامكس للشحن', 'type' => PartyType::COURIER->value, 'balance' => 600]);
        $supplier = Party::create(['user_id' => $this->owner->id, 'name' => 'مورد أقمشة', 'type' => PartyType::SUPPLIER->value, 'balance' => 800]);
        $customer = Party::create(['user_id' => $this->owner->id, 'name' => 'عميل مميز', 'type' => PartyType::CUSTOMER->value, 'balance' => 0]);

        Sanctum::actingAs($sales);
        $this->postJson("/api/couriers/{$courier->id}/settle", ['amount' => 100])->assertStatus(403);
        $this->postJson('/api/parties', ['name' => 'شركة شحن سيلز', 'type' => PartyType::COURIER->value])->assertStatus(403);

        Sanctum::actingAs($mandob);
        $this->postJson("/api/couriers/{$courier->id}/settle", ['amount' => 100])->assertStatus(403);
        $this->postJson('/api/parties', ['name' => 'شركة شحن مندوب', 'type' => PartyType::COURIER->value])->assertStatus(403);

        Sanctum::actingAs($cashier);
        $this->postJson("/api/couriers/{$courier->id}/settle", ['amount' => 150, 'method' => PaymentMethod::CASH->value])->assertOk();

        // Supervisor gets full operational permissions: courier settle, supplier ledger, CRM tier, stock alerts/movements/adjust
        Sanctum::actingAs($supervisor);
        $this->postJson("/api/couriers/{$courier->id}/settle", ['amount' => 150, 'method' => PaymentMethod::CASH->value])->assertOk();
        $this->getJson("/api/ledger/{$supplier->id}")->assertOk();
        $this->patchJson("/api/parties/{$customer->id}/tier", ['tier' => CustomerTier::VIP->value])->assertOk();
        $this->getJson('/api/stock/alerts')->assertOk();
        $this->getJson('/api/stock/movements')->assertOk();
        $this->postJson('/api/stock/adjust', [
            'branch_id' => $this->storeMain->id,
            'product_id' => $this->product->id,
            'mode' => StockAdjustmentMode::INCREASE->value,
            'quantity' => 2,
            'reason' => 'جرد دوري',
        ])->assertSuccessful();
        $this->deleteJson("/api/categories/{$this->category->id}")->assertStatus(403);
    }

    public function test_stock_transfers_permissions_for_supervisor_cashier_sales_and_mandob(): void
    {
        $supervisor = $this->createStaff(UserRole::SUPERVISOR, $this->storeMain, '01090000030');
        $cashierMain = $this->createStaff(UserRole::CASHIER, $this->storeMain, '01090000031');
        $salesMain = $this->createStaff(UserRole::SALES, $this->storeMain, '01090000032');
        $mandobVan = $this->createStaff(UserRole::MANDOB, $this->storeMain, '01090000033');

        // Supervisor creates transfer from own branch (storeMain -> warehouseSecond)
        Sanctum::actingAs($supervisor);
        $this->postJson('/api/stock-transfers', [
            'from_branch_id' => $this->storeMain->id,
            'to_branch_id' => $this->warehouseSecond->id,
            'items' => [['product_id' => $this->product->id, 'quantity_sent' => 1]],
        ])->assertStatus(201);

        $incomingToMain = StockTransfer::create([
            'user_id' => $this->owner->id,
            'created_by' => $this->owner->id,
            'from_branch_id' => $this->warehouseSecond->id,
            'to_branch_id' => $this->storeMain->id,
            'transfer_number' => 'TRF-IN-01',
            'status' => StockTransferStatus::IN_TRANSIT->value,
        ]);
        StockTransferItem::create(['stock_transfer_id' => $incomingToMain->id, 'product_id' => $this->product->id, 'quantity_sent' => 4]);

        Sanctum::actingAs($salesMain);
        $this->postJson("/api/stock-transfers/{$incomingToMain->id}/receive")->assertStatus(403);

        Sanctum::actingAs($mandobVan);
        $this->postJson("/api/stock-transfers/{$incomingToMain->id}/receive")->assertStatus(403);

        // Cashier cannot create transfers, but CAN receive incoming transfers for own branch
        Sanctum::actingAs($cashierMain);
        $this->postJson('/api/stock-transfers', [
            'from_branch_id' => $this->storeMain->id,
            'to_branch_id' => $this->warehouseSecond->id,
            'items' => [['product_id' => $this->product->id, 'quantity_sent' => 1]],
        ])->assertStatus(403);
        $this->postJson("/api/stock-transfers/{$incomingToMain->id}/receive")->assertOk();
    }

    public function test_read_only_branch_availability_excludes_vans_hides_costs_and_runs_in_constant_queries(): void
    {
        $variantProduct = Product::create([
            'user_id' => $this->owner->id,
            'category_id' => $this->category->id,
            'name' => 'تيشيرت بولو',
            'code' => 'POLO-1',
            'type' => ProductType::STANDARD->value,
            'purchase_price' => 99.95,
            'regular_price' => 300,
            'sale_price' => 280,
            'has_variants' => true,
            'quantity' => 30,
            'unit' => 'قطعة',
        ]);
        $redLarge = ProductVariant::create([
            'user_id' => $this->owner->id,
            'product_id' => $variantProduct->id,
            'name' => 'أحمر / L',
            'color' => 'أحمر',
            'size' => 'L',
            'code' => 'POLO-RL',
            'purchase_price' => 99.95,
            'regular_price' => 300,
            'sale_price' => 280,
            'quantity' => 15,
        ]);

        BranchStock::create(['branch_id' => $this->storeMain->id, 'product_id' => $variantProduct->id, 'product_variant_id' => $redLarge->id, 'quantity' => 5]);
        BranchStock::create(['branch_id' => $this->warehouseSecond->id, 'product_id' => $variantProduct->id, 'product_variant_id' => $redLarge->id, 'quantity' => 12]);
        BranchStock::create(['branch_id' => $this->vanBranch->id, 'product_id' => $variantProduct->id, 'product_variant_id' => $redLarge->id, 'quantity' => 20]);

        $confirmedOrder = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE->value,
            'external_order_id' => 'WC-RES-1',
            'branch_id' => $this->storeMain->id,
            'status' => WcOrderStatus::CONFIRMED->value,
            'payment_status' => WcPaymentStatus::PENDING_COD->value,
            'total' => 560,
            'date' => now(),
        ]);
        OnlineOrderItem::create([
            'user_id' => $this->owner->id,
            'online_order_id' => $confirmedOrder->id,
            'product_id' => $variantProduct->id,
            'product_variant_id' => $redLarge->id,
            'quantity' => 2,
        ]);

        $cashier = $this->createStaff(UserRole::CASHIER, $this->storeMain, '01090000040');
        Sanctum::actingAs($cashier);

        DB::flushQueryLog();
        DB::enableQueryLog();
        $res = $this->getJson("/api/products/{$variantProduct->id}/branch-availability")->assertOk();
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertLessThanOrEqual(8, count($queries));

        $branches = collect($res->json('data.branches'));
        $branchIds = $branches->pluck('id')->all();

        $this->assertContains($this->storeMain->id, $branchIds);
        $this->assertContains($this->warehouseSecond->id, $branchIds);
        $this->assertNotContains($this->vanBranch->id, $branchIds);
        $this->assertNotContains($this->inactiveStore->id, $branchIds);

        $mainRow = $branches->firstWhere('id', $this->storeMain->id);
        $this->assertEquals(5.0, (float) $mainRow['variants'][0]['physical_quantity']);
        $this->assertEquals(2.0, (float) $mainRow['variants'][0]['reserved_quantity']);
        $this->assertEquals(3.0, (float) $mainRow['variants'][0]['available_quantity']);

        $jsonPayload = json_encode($res->json('data'));
        $this->assertStringNotContainsString('purchase_price', $jsonPayload);
        $this->assertStringNotContainsString('99.95', $jsonPayload);
    }

    public function test_online_order_unclassified_visibility_branch_lock_and_cross_branch_transfer_routing(): void
    {
        $supervisor = $this->createStaff(UserRole::SUPERVISOR, $this->storeMain, '01090000050');
        $cashier = $this->createStaff(UserRole::CASHIER, $this->storeMain, '01090000051');

        $unclassifiedPending = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE->value,
            'external_order_id' => 'WC-UNCL-101',
            'branch_id' => null,
            'status' => WcOrderStatus::PENDING_CONFIRMATION->value,
            'payment_status' => WcPaymentStatus::PENDING_COD->value,
            'total' => 750,
            'date' => now(),
        ]);

        // StoreMain only has qty 3 of product, order requires qty 5, WarehouseSecond has 25
        $shortageOrder = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE->value,
            'external_order_id' => 'WC-SHORT-202',
            'branch_id' => $this->storeMain->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION->value,
            'payment_status' => WcPaymentStatus::PENDING_COD->value,
            'total' => 3750,
            'date' => now(),
        ]);
        OnlineOrderItem::create([
            'user_id' => $this->owner->id,
            'online_order_id' => $shortageOrder->id,
            'product_id' => $this->product->id,
            'quantity' => 5,
        ]);

        // Cashier can see unclassified PENDING_CONFIRMATION order, but cannot transfer branches
        Sanctum::actingAs($cashier);
        $cashierList = $this->getJson('/api/online-orders')->assertOk();
        $visibleIds = collect($cashierList->json('data.data'))->pluck('id')->all();
        $this->assertContains($unclassifiedPending->id, $visibleIds);

        // Cashier attempting to confirm unclassified order for foreign branch is rejected with 403, then succeeds for own branch
        $this->postJson("/api/online-orders/{$unclassifiedPending->id}/confirm", [
            'branch_id' => $this->warehouseSecond->id,
        ])->assertStatus(403);

        $this->postJson("/api/online-orders/{$unclassifiedPending->id}/confirm", [
            'branch_id' => $this->storeMain->id,
        ])->assertOk();
        $this->assertEquals($this->storeMain->id, $unclassifiedPending->fresh()->branch_id);

        $this->getJson("/api/online-orders/{$shortageOrder->id}/branch-availability")->assertStatus(403);
        $this->postJson("/api/online-orders/{$shortageOrder->id}/transfer-branch", [
            'target_branch_id' => $this->warehouseSecond->id,
        ])->assertStatus(403);

        // Supervisor checks order branch availability & routes order to warehouseSecond (VAN excluded & blocked)
        Sanctum::actingAs($supervisor);
        $availRes = $this->getJson("/api/online-orders/{$shortageOrder->id}/branch-availability")->assertOk();
        $evaluated = collect($availRes->json('data.branches'));
        $this->assertNotContains($this->vanBranch->id, $evaluated->pluck('id')->all());
        $this->assertFalse($evaluated->firstWhere('id', $this->storeMain->id)['can_fulfill_all']);
        $this->assertTrue($evaluated->firstWhere('id', $this->warehouseSecond->id)['can_fulfill_all']);

        // Reject VAN branch transfer
        $this->postJson("/api/online-orders/{$shortageOrder->id}/transfer-branch", [
            'target_branch_id' => $this->vanBranch->id,
        ])->assertStatus(422);

        // Successful fixed branch transfer resets status to PENDING_CONFIRMATION & appends audit log note
        $transferRes = $this->postJson("/api/online-orders/{$shortageOrder->id}/transfer-branch", [
            'target_branch_id' => $this->warehouseSecond->id,
            'reason' => 'نقص الرصيد بفرع مدينة نصر',
        ])->assertOk();

        $this->assertEquals($this->warehouseSecond->id, $transferRes->json('data.branch_id'));
        $this->assertEquals(WcOrderStatus::PENDING_CONFIRMATION->value, $transferRes->json('data.status'));
        $this->assertStringContainsString('تحويل فرع', (string) $shortageOrder->fresh()->notes);
    }

    public function test_cashier_and_mandob_locked_to_today_while_supervisor_sees_history_and_instapay_updates_mandob_shift(): void
    {
        Queue::fake();
        $supervisor = $this->createStaff(UserRole::SUPERVISOR, $this->storeMain, '01090000060');
        $cashier = $this->createStaff(UserRole::CASHIER, $this->storeMain, '01090000061');
        $mandob = $this->createStaff(UserRole::MANDOB, $this->storeMain, '01090000062');

        $mandobDrawer = Treasury::create([
            'user_id' => $this->owner->id,
            'name' => 'عهدة المندوب',
            'type' => TreasuryType::MANDOB_CUSTODY->value,
            'branch_id' => $this->storeMain->id,
            'assigned_user_id' => $mandob->id,
            'balance' => 0,
            'is_active' => true,
        ]);
        $mandobShift = Shift::create([
            'user_id' => $this->owner->id,
            'created_by' => $mandob->id,
            'treasury_id' => $mandobDrawer->id,
            'shift_number' => 'SH-INSTA-01',
            'status' => ShiftStatus::OPEN,
            'opened_at' => now(),
            'opening_balance' => 0,
        ]);

        $todayOrder = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE->value,
            'external_order_id' => 'WC-TODAY-1',
            'external_order_number' => '#701',
            'branch_id' => $this->storeMain->id,
            'mandob_id' => $mandob->id,
            'status' => WcOrderStatus::DISPATCHED->value,
            'payment_status' => WcPaymentStatus::PENDING_COD->value,
            'subtotal' => 115,
            'total' => 115,
            'order_date' => now(),
            'items_snapshot' => [
                [
                    'product_id' => $this->product->id,
                    'name' => $this->product->name,
                    'quantity' => 1,
                    'price' => 115,
                    'total' => 115,
                ],
            ],
        ]);
        OnlineOrderItem::create([
            'user_id' => $this->owner->id,
            'online_order_id' => $todayOrder->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
        ]);

        $pastMonthOrder = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE->value,
            'external_order_id' => 'WC-OLD-2',
            'external_order_number' => '#700',
            'branch_id' => $this->storeMain->id,
            'mandob_id' => $mandob->id,
            'status' => WcOrderStatus::DELIVERED->value,
            'payment_status' => WcPaymentStatus::COLLECTED->value,
            'subtotal' => 500,
            'total' => 500,
            'order_date' => now()->subDays(10),
        ]);

        $wideRangeQuery = '?date_from=' . now()->subDays(30)->toDateString() . '&date_to=' . now()->toDateString();

        // Cashier & Mandob MUST remain locked to today even if forging wide date range params
        foreach ([$cashier, $mandob] as $restrictedActor) {
            Sanctum::actingAs($restrictedActor);
            $res = $this->getJson('/api/online-orders' . $wideRangeQuery)->assertOk();
            $ids = collect($res->json('data.data'))->pluck('id')->all();
            $this->assertContains($todayOrder->id, $ids);
            $this->assertNotContains($pastMonthOrder->id, $ids);
            $this->assertEquals(115.0, (float) $res->json('summary.total_amount'));
        }

        // Supervisor sees full historical range & accurate summary total
        Sanctum::actingAs($supervisor);
        $supRes = $this->getJson('/api/online-orders' . $wideRangeQuery)->assertOk();
        $supIds = collect($supRes->json('data.data'))->pluck('id')->all();
        $this->assertContains($todayOrder->id, $supIds);
        $this->assertContains($pastMonthOrder->id, $supIds);
        $this->assertGreaterThanOrEqual(615.0, (float) $supRes->json('summary.total_amount'));

        // Delivering mandob order with INSTAPAY attaches to mandob's active shift electronic_sales
        $this->actingAs($this->owner)->postJson("/api/online-orders/{$todayOrder->id}/deliver", [
            'collected_amount' => 115,
            'payment_method' => PaymentMethod::INSTAPAY->value,
        ])->assertOk();

        $freshShift = $mandobShift->fresh();
        $this->assertEquals(0.0, (float) $freshShift->cash_sales);
        $this->assertEquals(115.0, (float) $freshShift->electronic_sales);
        $this->assertEquals(0.0, (float) $freshShift->expected_cash);
    }
}
