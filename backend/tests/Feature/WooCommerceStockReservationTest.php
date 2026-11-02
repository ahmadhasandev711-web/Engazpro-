<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WcOrderItem;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WooCommerceOrderSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WooCommerceStockReservationTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $mainBranch;
    protected WooCommerceOrderSyncService $syncService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => 'OWNER']);
        $this->mainBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'BR-01',
            'type' => 'STORE',
            'is_main' => true,
            'is_active' => true,
        ]);

        WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://test-shop.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'is_active' => true,
            'auto_sync_stock' => true,
            'online_branch_id' => $this->mainBranch->id,
        ]);

        $this->syncService = app(WooCommerceOrderSyncService::class);
    }

    /**
     * Item 1 / Test 7g: handleIncomingOrder persists correct wc_order_items records:
     * simple product, variant product, and unimported product (product_id = null).
     */
    public function test_handle_incoming_order_creates_correct_wc_order_items(): void
    {
        $simpleProduct = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف بسيط',
            'wc_product_id' => 101,
            'price' => 50,
            'cost_price' => 30,
            'quantity' => 10,
        ]);

        $variableProduct = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف متغير',
            'wc_product_id' => 102,
            'price' => 80,
            'cost_price' => 50,
            'quantity' => 10,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $variableProduct->id,
            'user_id' => $this->owner->id,
            'name' => 'أحمر - L',
            'wc_variation_id' => 202,
            'price' => 85,
            'cost_price' => 50,
            'quantity' => 5,
        ]);

        $orderPayload = [
            'id' => 7001,
            'status' => 'processing',
            'date_created' => now()->toIso8601String(),
            'total' => '350.00',
            'shipping_total' => '20.00',
            'discount_total' => '0.00',
            'billing' => [
                'first_name' => 'أحمد',
                'last_name' => 'محمد',
                'phone' => '01011112222',
            ],
            'line_items' => [
                [
                    'id' => 1,
                    'name' => 'صنف بسيط',
                    'product_id' => 101,
                    'variation_id' => 0,
                    'quantity' => 3,
                    'subtotal' => '150.00',
                    'total' => '150.00',
                ],
                [
                    'id' => 2,
                    'name' => 'صنف متغير - أحمر L',
                    'product_id' => 102,
                    'variation_id' => 202,
                    'quantity' => 2,
                    'subtotal' => '170.00',
                    'total' => '170.00',
                ],
                [
                    'id' => 3,
                    'name' => 'صنف غير مستورد',
                    'product_id' => 999,
                    'variation_id' => 0,
                    'quantity' => 1,
                    'subtotal' => '10.00',
                    'total' => '10.00',
                ],
            ],
        ];

        $order = $this->syncService->handleIncomingOrder($this->owner, $orderPayload);

        $this->assertDatabaseCount('wc_order_items', 3);

        $this->assertDatabaseHas('wc_order_items', [
            'wc_order_id' => $order->id,
            'user_id' => $this->owner->id,
            'product_id' => $simpleProduct->id,
            'product_variant_id' => null,
            'wc_product_id' => 101,
            'wc_variation_id' => null,
            'quantity' => '3.00',
        ]);

        $this->assertDatabaseHas('wc_order_items', [
            'wc_order_id' => $order->id,
            'user_id' => $this->owner->id,
            'product_id' => $variableProduct->id,
            'product_variant_id' => $variant->id,
            'wc_product_id' => 102,
            'wc_variation_id' => 202,
            'quantity' => '2.00',
        ]);

        $this->assertDatabaseHas('wc_order_items', [
            'wc_order_id' => $order->id,
            'user_id' => $this->owner->id,
            'product_id' => null,
            'product_variant_id' => null,
            'wc_product_id' => 999,
            'wc_variation_id' => null,
            'quantity' => '1.00',
        ]);

        $this->assertCount(3, $order->items);
    }

    /**
     * Item 3 / Test 7b: SHIPPED_VIA_COURIER is reserved in branch; DISPATCHED to mandob is NOT reserved in branch.
     */
    public function test_shipped_via_courier_is_reserved_while_dispatched_to_mandob_is_not(): void
    {
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'منتج حجز',
            'wc_product_id' => 501,
            'price' => 100,
            'cost_price' => 60,
            'quantity' => 20,
        ]);

        $orderCourier = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 8001,
            'branch_id' => $this->mainBranch->id,
            'status' => \App\Enums\WcOrderStatus::SHIPPED_VIA_COURIER,
            'payment_status' => \App\Enums\WcPaymentStatus::PENDING_COD,
            'total' => 300,
        ]);

        WcOrderItem::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => $orderCourier->id,
            'product_id' => $product->id,
            'wc_product_id' => 501,
            'quantity' => '3.00',
        ]);

        $orderMandob = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 8002,
            'branch_id' => $this->mainBranch->id,
            'status' => \App\Enums\WcOrderStatus::DISPATCHED,
            'payment_status' => \App\Enums\WcPaymentStatus::PENDING_COD,
            'total' => 400,
        ]);

        WcOrderItem::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => $orderMandob->id,
            'product_id' => $product->id,
            'wc_product_id' => 501,
            'quantity' => '4.00',
        ]);

        $service = app(\App\Services\WooCommerce\StockReservationService::class);
        $reserved = $service->reservedQuantity($this->owner->id, $product->id, null, [$this->mainBranch->id]);

        $this->assertInstanceOf(\App\Support\Quantity::class, $reserved);
        $this->assertSame('3.00', $reserved->toDecimalString());
    }

    /**
     * Item 3 / Test 7c: Order reserved on a branch outside target branches does not affect reservation.
     */
    public function test_order_reserved_on_branch_outside_target_branches_does_not_affect_reservation(): void
    {
        $branch2 = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع الإسكندرية',
            'code' => 'BR-02',
            'type' => 'STORE',
            'is_main' => false,
            'is_active' => true,
        ]);

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'منتج فرعي',
            'wc_product_id' => 502,
            'price' => 100,
            'cost_price' => 60,
            'quantity' => 20,
        ]);

        $orderBranch2 = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 8003,
            'branch_id' => $branch2->id,
            'status' => \App\Enums\WcOrderStatus::CONFIRMED,
            'payment_status' => \App\Enums\WcPaymentStatus::PENDING_COD,
            'total' => 500,
        ]);

        WcOrderItem::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => $orderBranch2->id,
            'product_id' => $product->id,
            'wc_product_id' => 502,
            'quantity' => '5.00',
        ]);

        $service = app(\App\Services\WooCommerce\StockReservationService::class);

        // Targeted only main branch -> should be 0.00
        $reservedMain = $service->reservedQuantity($this->owner->id, $product->id, null, [$this->mainBranch->id]);
        $this->assertSame('0.00', $reservedMain->toDecimalString());

        // Targeted both branches -> should be 5.00
        $reservedBoth = $service->reservedQuantity($this->owner->id, $product->id, null, [$this->mainBranch->id, $branch2->id]);
        $this->assertSame('5.00', $reservedBoth->toDecimalString());
    }

    /**
     * Item 4 / Test 7f: PushStockToWooCommerceJob throws WooCommerceConnectionException when updateProductStock returns false.
     */
    public function test_push_stock_job_throws_when_api_client_returns_false(): void
    {
        \Illuminate\Support\Facades\Queue::fake([
            \App\Jobs\PushStockToWooCommerceJob::class,
        ]);

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف فشل التحديث',
            'wc_product_id' => 9991,
            'price' => 50,
            'cost_price' => 30,
            'quantity' => 10,
        ]);

        BranchStock::create([
            'branch_id' => $this->mainBranch->id,
            'product_id' => $product->id,
            'quantity' => 10,
        ]);

        $mockClient = $this->createMock(\App\Contracts\WooCommerceApiClientInterface::class);
        $mockClient->expects($this->once())
            ->method('updateProductStock')
            ->willReturn(false);

        $this->expectException(\App\Exceptions\WooCommerceConnectionException::class);

        $job = new \App\Jobs\PushStockToWooCommerceJob($this->owner->id, $product->id);
        $job->handle($mockClient, app(\App\Services\WooCommerce\StockReservationService::class));
    }

    /**
     * Item 4: PushStockToWooCommerceJob sends variation available stock = branch stock minus reservedQuantity.
     */
    public function test_push_stock_job_pushes_variation_stock_minus_reserved_quantity(): void
    {
        \Illuminate\Support\Facades\Queue::fake([
            \App\Jobs\PushStockToWooCommerceJob::class,
        ]);

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف بمتغيرات',
            'wc_product_id' => 9993,
            'price' => 50,
            'cost_price' => 30,
            'quantity' => 10,
            'has_variants' => true,
        ]);

        $variant = ProductVariant::create([
            'user_id' => $this->owner->id,
            'product_id' => $product->id,
            'name' => 'أحمر - L',
            'wc_variation_id' => 8881,
            'price' => 50,
            'cost_price' => 30,
            'quantity' => 10,
        ]);

        BranchStock::create([
            'branch_id' => $this->mainBranch->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'quantity' => 10,
        ]);

        $order = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 8005,
            'branch_id' => $this->mainBranch->id,
            'status' => \App\Enums\WcOrderStatus::CONFIRMED,
            'payment_status' => \App\Enums\WcPaymentStatus::PENDING_COD,
            'total' => 150,
        ]);

        WcOrderItem::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => $order->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'wc_product_id' => 9993,
            'wc_variation_id' => 8881,
            'quantity' => '3.00',
        ]);

        $mockClient = $this->createMock(\App\Contracts\WooCommerceApiClientInterface::class);
        $mockClient->expects($this->once())
            ->method('updateVariationStock')
            ->with(
                $this->anything(),
                9993,
                8881,
                7.0 // 10.00 - 3.00 = 7.00
            )
            ->willReturn(true);

        $job = new \App\Jobs\PushStockToWooCommerceJob($this->owner->id, $product->id, $variant->id);
        $job->handle($mockClient, app(\App\Services\WooCommerce\StockReservationService::class));
    }

    /**
     * Item 4: PushStockToWooCommerceJob sends available stock = total stock minus reservedQuantity.
     */
    public function test_push_stock_job_pushes_branch_stock_minus_reserved_quantity(): void
    {
        \Illuminate\Support\Facades\Queue::fake([
            \App\Jobs\PushStockToWooCommerceJob::class,
        ]);

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف المزامنة المحجوز',
            'wc_product_id' => 9992,
            'price' => 50,
            'cost_price' => 30,
            'quantity' => 10,
        ]);

        BranchStock::create([
            'branch_id' => $this->mainBranch->id,
            'product_id' => $product->id,
            'quantity' => 10,
        ]);

        // Create pending order with reserved quantity 2.00
        $order = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 8004,
            'branch_id' => $this->mainBranch->id,
            'status' => \App\Enums\WcOrderStatus::PENDING_CONFIRMATION,
            'payment_status' => \App\Enums\WcPaymentStatus::PENDING_COD,
            'total' => 100,
        ]);

        WcOrderItem::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => $order->id,
            'product_id' => $product->id,
            'wc_product_id' => 9992,
            'quantity' => '2.00',
        ]);

        $mockClient = $this->createMock(\App\Contracts\WooCommerceApiClientInterface::class);
        $mockClient->expects($this->once())
            ->method('updateProductStock')
            ->with(
                $this->anything(),
                9992,
                8.0 // 10.00 - 2.00 = 8.00
            )
            ->willReturn(true);

        $job = new \App\Jobs\PushStockToWooCommerceJob($this->owner->id, $product->id);
        $job->handle($mockClient, app(\App\Services\WooCommerce\StockReservationService::class));
    }

    /**
     * Item 5 / Test 7d: confirmOrder calculates stock post-reservation and respects force override.
     */
    public function test_confirm_order_calculates_stock_post_reservation_and_respects_force_override(): void
    {
        \Illuminate\Support\Facades\Queue::fake([
            \App\Jobs\PushStockToWooCommerceJob::class,
        ]);

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف حجز التأكيد',
            'wc_product_id' => 7701,
            'price' => 100,
            'cost_price' => 60,
            'quantity' => 10,
        ]);

        BranchStock::create([
            'branch_id' => $this->mainBranch->id,
            'product_id' => $product->id,
            'quantity' => 10,
        ]);

        // Order A: already confirmed with 6.00 units (reserves 6.00 in branch)
        $orderA = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 9001,
            'branch_id' => $this->mainBranch->id,
            'status' => \App\Enums\WcOrderStatus::CONFIRMED,
            'payment_status' => \App\Enums\WcPaymentStatus::PENDING_COD,
            'total' => 600,
        ]);

        WcOrderItem::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => $orderA->id,
            'product_id' => $product->id,
            'wc_product_id' => 7701,
            'quantity' => '6.00',
        ]);

        // Order B: pending confirmation with 6.00 units
        $orderB = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 9002,
            'branch_id' => $this->mainBranch->id,
            'status' => \App\Enums\WcOrderStatus::PENDING_CONFIRMATION,
            'payment_status' => \App\Enums\WcPaymentStatus::PENDING_COD,
            'total' => 600,
        ]);

        WcOrderItem::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => $orderB->id,
            'product_id' => $product->id,
            'wc_product_id' => 7701,
            'quantity' => '6.00',
        ]);

        // Without force: raw stock is 10, but reserved is 6 -> available is 4.00, required is 6.00 -> must throw
        try {
            $this->syncService->confirmOrder($this->owner, $orderB, $this->mainBranch->id, force: false);
            $this->fail('Expected PosDomainException was not thrown on insufficient available stock.');
        } catch (\App\Exceptions\PosDomainException $e) {
            $this->assertSame('INSUFFICIENT_ONLINE_STOCK', $e->getErrorCode());
            $this->assertStringContainsString('4.00', $e->getMessage());
            $this->assertStringContainsString('6.00', $e->getMessage());
        }

        // With force: true -> succeeds and records warning in notes
        $confirmedOrder = $this->syncService->confirmOrder($this->owner, $orderB, $this->mainBranch->id, force: true);
        $this->assertSame(\App\Enums\WcOrderStatus::CONFIRMED, $confirmedOrder->status);
        $this->assertStringContainsString('تأكيد مع نقص مخزون', (string) $confirmedOrder->notes);
    }
}
