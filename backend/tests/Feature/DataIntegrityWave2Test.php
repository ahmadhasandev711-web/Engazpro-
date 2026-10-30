<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\StockTransferStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\Subscription;
use App\Models\User;
use App\Services\StockTransferService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DataIntegrityWave2Test extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $fromBranch;
    protected Branch $toBranch;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'تاجر الموجة 2',
            'phone' => '01011112222',
            'password' => bcrypt('password123'),
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->fromBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع الإرسال',
            'code' => 'BR-01',
            'type' => BranchType::STORE,
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->toBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع الاستلام',
            'code' => 'BR-02',
            'type' => BranchType::STORE,
            'is_main' => false,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف تجربة أمان',
            'purchase_price' => 50,
            'sale_price' => 100,
            'quantity' => 20,
        ]);
    }

    /**
     * Item 1 (Regression Guard): Transfer receipt and cancellation update branch stocks consistently
     */
    public function test_transfer_receipt_and_cancellation_update_branch_stock_consistently(): void
    {
        $service = app(StockTransferService::class);

        // 1. إنشاء تحويل
        $transfer = StockTransfer::create([
            'user_id' => $this->owner->id,
            'transfer_number' => 'TRF-00001',
            'from_branch_id' => $this->fromBranch->id,
            'to_branch_id' => $this->toBranch->id,
            'status' => StockTransferStatus::IN_TRANSIT,
            'created_by' => $this->owner->id,
            'transferred_at' => now(),
        ]);

        StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $this->product->id,
            'quantity_sent' => 5,
        ]);

        // استلام التحويل في فرع الوجهة
        $receivedTransfer = $service->receiveTransfer($this->owner, $transfer);
        $this->assertEquals(StockTransferStatus::RECEIVED, $receivedTransfer->status);

        $toStock = BranchStock::where('branch_id', $this->toBranch->id)
            ->where('product_id', $this->product->id)
            ->first();
        $this->assertNotNull($toStock);
        $this->assertEquals(5, $toStock->quantity);

        // 2. تجربة إلغاء تحويل آخر وإرجاعه لفرع المصدر
        $transfer2 = StockTransfer::create([
            'user_id' => $this->owner->id,
            'transfer_number' => 'TRF-00002',
            'from_branch_id' => $this->fromBranch->id,
            'to_branch_id' => $this->toBranch->id,
            'status' => StockTransferStatus::IN_TRANSIT,
            'created_by' => $this->owner->id,
            'transferred_at' => now(),
        ]);

        StockTransferItem::create([
            'stock_transfer_id' => $transfer2->id,
            'product_id' => $this->product->id,
            'quantity_sent' => 3,
        ]);

        $cancelledTransfer = $service->cancelTransfer($this->owner, $transfer2, 'إلغاء للاختبار');
        $this->assertEquals(StockTransferStatus::CANCELLED, $cancelledTransfer->status);

        $fromStock = BranchStock::where('branch_id', $this->fromBranch->id)
            ->where('product_id', $this->product->id)
            ->first();
        $this->assertNotNull($fromStock);
        $this->assertEquals(3, $fromStock->quantity);
    }

    /**
     * Item 2: Mandob active shift is linked to WooCommerce cash delivery invoice
     */
    public function test_mandob_active_shift_is_linked_to_woocommerce_cash_delivery_invoice(): void
    {
        $mockClient = \Mockery::mock(\App\Contracts\WooCommerceApiClientInterface::class);
        $mockClient->shouldReceive('updateOrderStatus')->andReturn(true);
        $this->app->instance(\App\Contracts\WooCommerceApiClientInterface::class, $mockClient);

        // صنف مع رصيد في الفرع
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'منتج ووكومرس',
            'wc_product_id' => 888,
            'price' => 100,
            'cost_price' => 50,
            'quantity' => 10,
        ]);
        BranchStock::create([
            'branch_id' => $this->fromBranch->id,
            'product_id' => $product->id,
            'quantity' => 10,
        ]);

        // مندوب تابع للمتجر
        $mandob = User::create([
            'name' => 'مندوب كاش',
            'phone' => '01033334444',
            'password' => bcrypt('password123'),
            'role' => \App\Enums\UserRole::MANDOB->value,
            'owner_id' => $this->owner->id,
            'status' => 'ACTIVE',
        ]);

        // فتح وردية للمندوب
        $shiftService = app(\App\Services\ShiftService::class);
        $shift = $shiftService->openShift($mandob, 50.0);

        // إنشاء أوردر ووكومرس وتكليف المندوب به
        $order = \App\Models\WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 7771,
            'branch_id' => $this->fromBranch->id,
            'mandob_id' => $mandob->id,
            'status' => \App\Enums\WcOrderStatus::DISPATCHED,
            'payment_status' => \App\Enums\WcPaymentStatus::PENDING_COD,
            'wc_payment_method' => 'cod',
            'shipping_cost' => 10,
            'subtotal' => 100,
            'discount_total' => 0,
            'total' => 110,
            'customer_name' => 'عميل الدفع كاش',
            'customer_phone' => '01012345678',
            'items_snapshot' => [
                [
                    'product_id' => 888,
                    'name' => 'منتج ووكومرس',
                    'quantity' => 1,
                    'price' => 100,
                    'total' => 100,
                ],
            ],
        ]);

        $mockInvoiceService = \Mockery::mock(\App\Services\InvoiceService::class);
        $dummyInvoice = new \App\Models\Invoice([
            'id' => 12345,
            'user_id' => $this->owner->id,
            'type' => 'SALE',
            'shift_id' => $shift->id,
            'total' => 110,
        ]);
        $mockInvoiceService->shouldReceive('createInvoice')
            ->once()
            ->with(
                \Mockery::any(),
                \Mockery::on(function ($invoiceData) use ($shift) {
                    return isset($invoiceData['shift_id']) && $invoiceData['shift_id'] === $shift->id;
                })
            )
            ->andReturn($dummyInvoice);
        $this->app->instance(\App\Services\InvoiceService::class, $mockInvoiceService);

        $syncService = app(\App\Services\WooCommerce\WooCommerceOrderSyncService::class);
        $invoice = $syncService->deliverOrder($this->owner, $order, [
            'collected_amount' => 110,
            'payment_method' => 'CASH',
        ]);

        $this->assertNotNull($invoice->shift_id, 'الفاتورة يجب أن ترتبط بوردية المندوب المفتوحة');
        $this->assertEquals($shift->id, $invoice->shift_id);
    }

    /**
     * Item 3: Branch stock out movement rejects negative stock when setting is disabled (Default: false)
     */
    public function test_branch_stock_out_movement_rejects_negative_stock_when_setting_disabled(): void
    {
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'سكر محلي',
            'purchase_price' => 20,
            'sale_price' => 30,
            'quantity' => 10, // إجمالي الصنف 10
        ]);

        BranchStock::create([
            'branch_id' => $this->fromBranch->id,
            'product_id' => $product->id,
            'quantity' => 2, // رصيد الفرع 2 فقط
        ]);

        $stockService = app(\App\Services\StockService::class);

        // محاولة بيع / صرف 3 من الفرع الذي يحتوي على 2 فقط
        $this->expectException(\App\Exceptions\InsufficientStockException::class);

        try {
            $stockService->recordMovement(
                user: $this->owner,
                product: $product,
                type: 'OUT',
                sourceType: 'SALE',
                sourceId: 101,
                quantity: 3,
                branchId: $this->fromBranch->id
            );
        } catch (\App\Exceptions\InsufficientStockException $e) {
            $this->assertEquals('INSUFFICIENT_BRANCH_STOCK', $e->getErrorCode());
            $this->assertStringContainsString($this->fromBranch->name, $e->getMessage());
            $this->assertStringContainsString('2', $e->getMessage());
            throw $e;
        }
    }

    /**
     * Item 3: Branch stock out movement allows negative stock when setting is enabled and tags notes with [بيع على المكشوف]
     */
    public function test_branch_stock_out_movement_allows_negative_when_setting_enabled_and_tags_notes(): void
    {
        $settingService = app(\App\Services\SettingService::class);
        $settingService->updateStoreIdentity($this->owner, [
            'business_name' => 'متجر المكشوف',
            'currency' => 'ج.م',
            'allow_negative_branch_stock' => true,
        ]);

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'زيت طعام',
            'purchase_price' => 40,
            'sale_price' => 60,
            'quantity' => 10,
        ]);

        BranchStock::create([
            'branch_id' => $this->fromBranch->id,
            'product_id' => $product->id,
            'quantity' => 2,
        ]);

        $stockService = app(\App\Services\StockService::class);

        $movement = $stockService->recordMovement(
            user: $this->owner,
            product: $product,
            type: 'OUT',
            sourceType: 'SALE',
            sourceId: 102,
            quantity: 3,
            notes: 'بيعة تجريبية',
            branchId: $this->fromBranch->id
        );

        $this->assertNotNull($movement);
        $this->assertStringContainsString('[بيع على المكشوف]', $movement->notes);

        $branchStock = BranchStock::where('branch_id', $this->fromBranch->id)
            ->where('product_id', $product->id)
            ->first();
        $this->assertEquals(-1, $branchStock->quantity);
    }

    /**
     * Item 4: Red test - DocumentSequenceService prevents duplicate numbering when records are deleted (count+1 vulnerability)
     */
    public function test_document_sequence_prevents_duplicate_numbers_after_deletion(): void
    {
        $transferService = app(\App\Services\StockTransferService::class);

        $transfer1 = $transferService->createTransfer($this->owner, [
            'from_branch_id' => $this->fromBranch->id,
            'to_branch_id' => $this->toBranch->id,
            'items' => [],
        ]);
        $this->assertEquals('TRF-00001', $transfer1->transfer_number);

        $transfer2 = $transferService->createTransfer($this->owner, [
            'from_branch_id' => $this->fromBranch->id,
            'to_branch_id' => $this->toBranch->id,
            'items' => [],
        ]);
        $this->assertEquals('TRF-00002', $transfer2->transfer_number);

        // حذف التحويل الثاني (أو أي سيناريو يجعل count() = 1)
        $transfer2->delete();

        // إنشاء تحويل ثالث: في الترقيم بـ count+1 القديم سينتج TRF-00002 مكرراً!
        // أما مع DocumentSequenceService فيجب أن ينتج TRF-00003
        $transfer3 = $transferService->createTransfer($this->owner, [
            'from_branch_id' => $this->fromBranch->id,
            'to_branch_id' => $this->toBranch->id,
            'items' => [],
        ]);

        $this->assertEquals('TRF-00003', $transfer3->transfer_number);
    }

    /**
     * Item 4: Regression guard - Initial invoice in a new store starts with INV-00001
     */
    public function test_initial_invoice_in_new_store_starts_with_inv_00001(): void
    {
        $customer = \App\Models\Party::create([
            'user_id' => $this->owner->id,
            'type' => \App\Enums\PartyType::CUSTOMER->value,
            'name' => 'عميل أول فاتورة',
        ]);

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف أولي',
            'purchase_price' => 10,
            'sale_price' => 20,
            'quantity' => 10,
        ]);

        BranchStock::create([
            'branch_id' => $this->fromBranch->id,
            'product_id' => $product->id,
            'quantity' => 10,
        ]);

        $invoiceService = app(\App\Services\InvoiceService::class);
        $invoice = $invoiceService->createInvoice($this->owner, [
            'type' => 'SALE',
            'party_id' => $customer->id,
            'branch_id' => $this->fromBranch->id,
            'payment_method' => 'CASH',
            'paid_amount' => 20,
            'date' => now()->toDateString(),
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 1,
                    'unit_price' => 20,
                ],
            ],
        ]);

        $this->assertEquals('INV-00001', $invoice->invoice_number);
    }
}
