<?php

namespace Tests\Feature;

use App\Contracts\WooCommerceApiClientInterface;
use App\Enums\BranchType;
use App\Enums\StockTransferStatus;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Exceptions\PosDomainException;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\StockTransfer;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WooCommerceIntegration;
use App\Services\StockTransferService;
use App\Services\WooCommerce\WcOrderVanTransferService;
use App\Services\WooCommerce\WooCommerceOrderSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class WooCommerceVanDeliveryTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $mainBranch;
    protected WooCommerceIntegration $integration;

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

        $this->integration = WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://mystore.test',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'webhook_secret' => 'sec_test',
            'online_branch_id' => $this->mainBranch->id,
            'is_active' => true,
        ]);

        $mockClient = Mockery::mock(WooCommerceApiClientInterface::class);
        $mockClient->shouldReceive('updateOrderStatus')->andReturn(true);
        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);
    }

    protected function createProductAndStock(int $qty = 10): Product
    {
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'منتج اختباري',
            'wc_product_id' => 999,
            'price' => 100,
            'cost_price' => 60,
            'quantity' => $qty,
        ]);

        BranchStock::create([
            'branch_id' => $this->mainBranch->id,
            'product_id' => $product->id,
            'quantity' => $qty,
        ]);

        return $product;
    }

    protected function createOrder(array $attributes = []): WcOrder
    {
        return WcOrder::create(array_merge([
            'user_id' => $this->owner->id,
            'wc_order_id' => 9001,
            'branch_id' => $this->mainBranch->id,
            'status' => WcOrderStatus::CONFIRMED,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'wc_payment_method' => 'cod',
            'shipping_cost' => 20,
            'subtotal' => 200,
            'discount_total' => 0,
            'total' => 220,
            'customer_name' => 'عميل اختبار',
            'customer_phone' => '01011112222',
            'items_snapshot' => [
                [
                    'product_id' => 999,
                    'name' => 'منتج اختباري',
                    'quantity' => 2,
                    'price' => 100,
                    'total' => 200,
                ],
            ],
        ], $attributes));
    }

    /**
     * T1: IN_TRANSIT transfer settles on delivery, transfer becomes RECEIVED, VAN stock = 0, invoice.branch_id = VAN
     */
    public function test_deliver_order_settles_in_transit_van_transfer_and_deducts_van_stock(): void
    {
        $product = $this->createProductAndStock(10);

        $vanBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'سيارة المندوب 1',
            'code' => 'VAN-01',
            'type' => BranchType::VAN,
            'is_active' => true,
        ]);

        $mandob = User::create([
            'name' => 'مندوب التوصيل 1',
            'phone' => '01099990001',
            'password' => bcrypt('password123'),
            'owner_id' => $this->owner->id,
            'branch_id' => $vanBranch->id,
        ]);

        $order = $this->createOrder();

        $syncService = app(WooCommerceOrderSyncService::class);
        $syncService->dispatchToMandob($this->owner, $order, $mandob->id);

        $vanTransferService = app(WcOrderVanTransferService::class);
        $transfer = $vanTransferService->findForOrder($this->owner->id, $order);

        $this->assertNotNull($transfer);
        $this->assertEquals(StockTransferStatus::IN_TRANSIT, $transfer->status);

        $invoice = $syncService->deliverOrder($this->owner, $order->fresh(), [
            'collected_amount' => 220,
            'payment_method' => 'CASH',
        ]);

        $this->assertEquals(StockTransferStatus::RECEIVED, $transfer->fresh()->status);
        $this->assertEquals($vanBranch->id, $invoice->branch_id);
        $this->assertEquals(WcOrderStatus::DELIVERED, $order->fresh()->status);

        $vanStock = BranchStock::where('branch_id', $vanBranch->id)
            ->where('product_id', $product->id)
            ->value('quantity');
        $this->assertEquals(0.0, (float) $vanStock);
    }

    /**
     * T2: CANCELLED transfer throws DISPATCH_TRANSFER_NOT_ACTIVE, creates no invoice, order stays DISPATCHED
     */
    public function test_deliver_order_with_cancelled_transfer_throws_dispatch_transfer_not_active(): void
    {
        $this->createProductAndStock(10);

        $vanBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'سيارة المندوب 2',
            'code' => 'VAN-02',
            'type' => BranchType::VAN,
            'is_active' => true,
        ]);

        $mandob = User::create([
            'name' => 'مندوب التوصيل 2',
            'phone' => '01099990002',
            'password' => bcrypt('password123'),
            'owner_id' => $this->owner->id,
            'branch_id' => $vanBranch->id,
        ]);

        $order = $this->createOrder(['wc_order_id' => 9002]);

        $syncService = app(WooCommerceOrderSyncService::class);
        $syncService->dispatchToMandob($this->owner, $order, $mandob->id);

        $vanTransferService = app(WcOrderVanTransferService::class);
        $transfer = $vanTransferService->findForOrder($this->owner->id, $order);
        $this->assertNotNull($transfer);

        app(StockTransferService::class)->cancelTransfer($this->owner, $transfer, 'إلغاء تجريبي');
        $this->assertEquals(StockTransferStatus::CANCELLED, $transfer->fresh()->status);

        try {
            $syncService->deliverOrder($this->owner, $order->fresh(), [
                'collected_amount' => 220,
                'payment_method' => 'CASH',
            ]);
            $this->fail('Expected PosDomainException was not thrown');
        } catch (PosDomainException $e) {
            $this->assertEquals('DISPATCH_TRANSFER_NOT_ACTIVE', $e->getErrorCode());
            $this->assertEquals(422, $e->getStatusCode());
        }

        $this->assertEquals(WcOrderStatus::DISPATCHED, $order->fresh()->status);
        $this->assertEquals(0, Invoice::where('wc_order_id', 9002)->count());
    }

    /**
     * T3: Mandob branch_id = store branch but transfer went to VAN -> invoice.branch_id = to_branch_id, store stock deducted once
     */
    public function test_deliver_order_uses_transfer_to_branch_and_prevents_duplicate_shop_deduction(): void
    {
        $product = $this->createProductAndStock(10);

        $vanBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'سيارة المندوب 3',
            'code' => 'VAN-03',
            'type' => BranchType::VAN,
            'is_active' => true,
        ]);

        // Mandob assigned to main branch, not van branch
        $mandob = User::create([
            'name' => 'مندوب فرع المحل',
            'phone' => '01099990003',
            'password' => bcrypt('password123'),
            'owner_id' => $this->owner->id,
            'branch_id' => $this->mainBranch->id,
        ]);

        $order = $this->createOrder(['wc_order_id' => 9003]);

        $syncService = app(WooCommerceOrderSyncService::class);
        $syncService->dispatchToMandob($this->owner, $order, $mandob->id);

        $storeStockAfterDispatch = (float) BranchStock::where('branch_id', $this->mainBranch->id)
            ->where('product_id', $product->id)
            ->value('quantity');
        $this->assertEquals(8.0, $storeStockAfterDispatch);

        $invoice = $syncService->deliverOrder($this->owner, $order->fresh(), [
            'collected_amount' => 220,
            'payment_method' => 'CASH',
        ]);

        $this->assertEquals($vanBranch->id, $invoice->branch_id);

        $storeStockAfterDelivery = (float) BranchStock::where('branch_id', $this->mainBranch->id)
            ->where('product_id', $product->id)
            ->value('quantity');
        $this->assertEquals(8.0, $storeStockAfterDelivery);

        $vanStockAfterDelivery = (float) BranchStock::where('branch_id', $vanBranch->id)
            ->where('product_id', $product->id)
            ->value('quantity');
        $this->assertEquals(0.0, $vanStockAfterDelivery);
    }

    /**
     * T4 (regression guard): Manual receive before delivery -> only 1 TRANSFER_IN movement exists
     */
    public function test_deliver_order_with_already_received_transfer_does_not_duplicate_transfer_in_movement(): void
    {
        $product = $this->createProductAndStock(10);

        $vanBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'سيارة المندوب 4',
            'code' => 'VAN-04',
            'type' => BranchType::VAN,
            'is_active' => true,
        ]);

        $mandob = User::create([
            'name' => 'مندوب التوصيل 4',
            'phone' => '01099990004',
            'password' => bcrypt('password123'),
            'owner_id' => $this->owner->id,
            'branch_id' => $vanBranch->id,
        ]);

        $order = $this->createOrder(['wc_order_id' => 9004]);

        $syncService = app(WooCommerceOrderSyncService::class);
        $syncService->dispatchToMandob($this->owner, $order, $mandob->id);

        $vanTransferService = app(WcOrderVanTransferService::class);
        $transfer = $vanTransferService->findForOrder($this->owner->id, $order);
        $this->assertNotNull($transfer);

        // Manually receive before delivery
        app(StockTransferService::class)->receiveTransfer($this->owner, $transfer);
        $this->assertEquals(StockTransferStatus::RECEIVED, $transfer->fresh()->status);

        $transferInCountBefore = StockMovement::where('source_type', 'TRANSFER_IN')
            ->where('source_id', $transfer->id)
            ->count();
        $this->assertEquals(1, $transferInCountBefore);

        $invoice = $syncService->deliverOrder($this->owner, $order->fresh(), [
            'collected_amount' => 220,
            'payment_method' => 'CASH',
        ]);

        $this->assertEquals(WcOrderStatus::DELIVERED, $order->fresh()->status);

        $transferInCountAfter = StockMovement::where('source_type', 'TRANSFER_IN')
            ->where('source_id', $transfer->id)
            ->count();
        $this->assertEquals(1, $transferInCountAfter);

        $vanStockAfterDelivery = (float) BranchStock::where('branch_id', $vanBranch->id)
            ->where('product_id', $product->id)
            ->value('quantity');
        $this->assertEquals(0.0, $vanStockAfterDelivery);
    }
}
