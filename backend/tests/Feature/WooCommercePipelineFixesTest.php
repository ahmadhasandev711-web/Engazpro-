<?php

namespace Tests\Feature;

use App\Contracts\WooCommerceApiClientInterface;
use App\Enums\BranchType;
use App\Enums\StockTransferStatus;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Exceptions\PosDomainException;
use App\Exceptions\WooCommerceConnectionException;
use App\Jobs\SyncOrderStatusToWooCommerceJob;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Invoice;
use App\Models\Party;
use App\Models\Product;
use App\Models\StockTransfer;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WooCommerceOrderSyncService;
use Exception;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Mockery;
use Tests\TestCase;

class WooCommercePipelineFixesTest extends TestCase
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
    }

    protected function createTestOrder(array $attributes = []): WcOrder
    {
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'منتج اختباري',
            'wc_product_id' => 999,
            'price' => 100,
            'cost_price' => 60,
            'quantity' => 10,
        ]);

        BranchStock::create([
            'branch_id' => $this->mainBranch->id,
            'product_id' => $product->id,
            'quantity' => 10,
        ]);

        return WcOrder::create(array_merge([
            'user_id' => $this->owner->id,
            'wc_order_id' => 5001,
            'branch_id' => $this->mainBranch->id,
            'status' => WcOrderStatus::DISPATCHED,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'wc_payment_method' => 'cod',
            'shipping_cost' => 20,
            'subtotal' => 200,
            'discount_total' => 0,
            'total' => 220,
            'customer_name' => 'عميل تجربة',
            'customer_phone' => '01011112222',
            'items_snapshot' => [
                [
                    'product_id' => 999,
                    'name' => 'منتج اختباري',
                    'quantity' => 2,
                    'price' => 100,
                    'total' => 200,
                ]
            ],
        ], $attributes));
    }

    /**
     * Commit 1: deliverOrder dispatches SyncOrderStatusToWooCommerceJob
     */
    public function test_deliver_order_dispatches_sync_job_and_notifies_woo(): void
    {
        Queue::fake();

        $order = $this->createTestOrder();

        $syncService = app(WooCommerceOrderSyncService::class);
        $invoice = $syncService->deliverOrder($this->owner, $order, [
            'collected_amount' => 220,
            'payment_method' => 'CASH',
        ]);

        $this->assertInstanceOf(Invoice::class, $invoice);
        $this->assertEquals(WcOrderStatus::DELIVERED, $order->fresh()->status);

        Queue::assertPushed(SyncOrderStatusToWooCommerceJob::class, function ($job) use ($order) {
            return $job->userId === $this->owner->id
                && $job->wcOrderId === $order->wc_order_id
                && $job->status === 'completed';
        });
    }

    /**
     * Commit 1: SyncOrderStatusToWooCommerceJob calls apiClient to update order status
     */
    public function test_sync_job_calls_api_client_with_completed_status(): void
    {
        $mockClient = Mockery::mock(WooCommerceApiClientInterface::class);
        $mockClient->shouldReceive('updateOrderStatus')
            ->once()
            ->withArgs(function ($integration, $wcOrderId, $status) {
                return $integration->id === $this->integration->id
                    && $wcOrderId === 5001
                    && $status === 'completed';
            })
            ->andReturn(true);

        $job = new SyncOrderStatusToWooCommerceJob($this->owner->id, 5001, 'completed');
        $job->handle($mockClient);
    }

    /**
     * Commit 1: SyncOrderStatusToWooCommerceJob throws WooCommerceConnectionException when updateOrderStatus returns false
     */
    public function test_sync_job_throws_when_api_client_returns_false(): void
    {
        $mockClient = Mockery::mock(WooCommerceApiClientInterface::class);
        $mockClient->shouldReceive('updateOrderStatus')
            ->once()
            ->withArgs(function ($integration, $wcOrderId, $status) {
                return $integration->id === $this->integration->id
                    && $wcOrderId === 5001
                    && $status === 'completed';
            })
            ->andReturn(false);

        $this->expectException(WooCommerceConnectionException::class);

        $job = new SyncOrderStatusToWooCommerceJob($this->owner->id, 5001, 'completed');
        $job->handle($mockClient);
    }

    /**
     * Commit 1: deliverOrder calls updateOrderStatus with completed once via API client mock
     */
    public function test_deliver_order_calls_api_client_update_order_status_once_with_completed(): void
    {
        $order = $this->createTestOrder();

        $mockClient = Mockery::mock(WooCommerceApiClientInterface::class);
        $mockClient->shouldReceive('updateOrderStatus')
            ->once()
            ->withArgs(function ($integration, $wcOrderId, $status) use ($order) {
                return $integration->id === $this->integration->id
                    && $wcOrderId === $order->wc_order_id
                    && $status === 'completed';
            })
            ->andReturn(true);
        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);

        $syncService = app(WooCommerceOrderSyncService::class);
        $invoice = $syncService->deliverOrder($this->owner, $order, [
            'collected_amount' => 220,
            'payment_method' => 'CASH',
        ]);

        $this->assertInstanceOf(Invoice::class, $invoice);
        $this->assertEquals(WcOrderStatus::DELIVERED, $order->fresh()->status);
    }

    /**
     * Commit 1: Network failure or false response during api update does not affect deliverOrder
     */
    public function test_deliver_order_succeeds_even_when_api_client_fails(): void
    {
        $order = $this->createTestOrder();

        $mockClient = Mockery::mock(WooCommerceApiClientInterface::class);
        $mockClient->shouldReceive('updateOrderStatus')
            ->andReturn(false);
        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);

        $syncService = app(WooCommerceOrderSyncService::class);
        $invoice = $syncService->deliverOrder($this->owner, $order, [
            'collected_amount' => 220,
            'payment_method' => 'CASH',
        ]);

        $this->assertInstanceOf(Invoice::class, $invoice);
        $order->refresh();
        $this->assertEquals(WcOrderStatus::DELIVERED, $order->status);
        $this->assertEquals($invoice->id, $order->invoice_id);
    }

    /**
     * Commit 1 (Adjustment 3): deliverOrder is idempotent and returns the same invoice
     */
    public function test_deliver_order_is_idempotent_and_returns_same_invoice(): void
    {
        $order = $this->createTestOrder();

        $syncService = app(WooCommerceOrderSyncService::class);
        $invoice1 = $syncService->deliverOrder($this->owner, $order, [
            'collected_amount' => 220,
            'payment_method' => 'CASH',
        ]);

        $invoiceCountBefore = Invoice::count();

        // Deliver again
        $invoice2 = $syncService->deliverOrder($this->owner, $order->fresh(), [
            'collected_amount' => 220,
            'payment_method' => 'CASH',
        ]);

        $this->assertEquals($invoice1->id, $invoice2->id);
        $this->assertEquals($invoiceCountBefore, Invoice::count(), 'No new invoice should be created on duplicate delivery');
    }

    /**
     * Commit 2: Confirming an already confirmed order throws PosDomainException (INVALID_ORDER_STATUS_TRANSITION)
     */
    public function test_confirm_order_twice_throws_invalid_order_status_transition(): void
    {
        $order = $this->createTestOrder(['status' => WcOrderStatus::PENDING_CONFIRMATION]);

        $syncService = app(WooCommerceOrderSyncService::class);
        $syncService->confirmOrder($this->owner, $order, $this->mainBranch->id);

        $this->assertEquals(WcOrderStatus::CONFIRMED, $order->fresh()->status);

        try {
            $syncService->confirmOrder($this->owner, $order->fresh(), $this->mainBranch->id);
            $this->fail('Expected PosDomainException was not thrown');
        } catch (PosDomainException $e) {
            $this->assertEquals('INVALID_ORDER_STATUS_TRANSITION', $e->getErrorCode());
            $this->assertEquals(422, $e->getStatusCode());
        }
    }

    /**
     * Commit 2: Returning an already returned order throws PosDomainException (INVALID_ORDER_STATUS_TRANSITION)
     */
    public function test_return_order_twice_throws_invalid_order_status_transition(): void
    {
        $order = $this->createTestOrder(['status' => WcOrderStatus::DISPATCHED]);

        $syncService = app(WooCommerceOrderSyncService::class);
        $syncService->returnOrder($this->owner, $order, 'زبون رفض الاستلام');

        $this->assertEquals(WcOrderStatus::RETURNED, $order->fresh()->status);

        try {
            $syncService->returnOrder($this->owner, $order->fresh(), 'محاولة مرتجع ثانية');
            $this->fail('Expected PosDomainException was not thrown');
        } catch (PosDomainException $e) {
            $this->assertEquals('INVALID_ORDER_STATUS_TRANSITION', $e->getErrorCode());
            $this->assertEquals(422, $e->getStatusCode());
        }
    }

    /**
     * Commit 2: Delivering a cancelled order throws PosDomainException (INVALID_ORDER_STATUS_TRANSITION)
     */
    public function test_deliver_cancelled_order_throws_invalid_order_status_transition(): void
    {
        $order = $this->createTestOrder(['status' => WcOrderStatus::CANCELLED]);

        $syncService = app(WooCommerceOrderSyncService::class);

        try {
            $syncService->deliverOrder($this->owner, $order, [
                'collected_amount' => 220,
                'payment_method' => 'CASH',
            ]);
            $this->fail('Expected PosDomainException was not thrown');
        } catch (PosDomainException $e) {
            $this->assertEquals('INVALID_ORDER_STATUS_TRANSITION', $e->getErrorCode());
            $this->assertEquals(422, $e->getStatusCode());
        }
    }

    /**
     * Commit 3: Cancellation from webhook updates status to CANCELLED if order is CONFIRMED
     */
    public function test_webhook_syncs_cancellation_when_order_is_confirmed(): void
    {
        $order = $this->createTestOrder(['status' => WcOrderStatus::CONFIRMED]);

        $syncService = app(WooCommerceOrderSyncService::class);
        $updated = $syncService->handleIncomingOrder($this->owner, [
            'id' => $order->wc_order_id,
            'status' => 'cancelled',
        ]);

        $this->assertEquals(WcOrderStatus::CANCELLED, $updated->status);
        $this->assertEquals(WcOrderStatus::CANCELLED, $order->fresh()->status);
    }

    /**
     * Commit 3: Cancellation from webhook logs warning in notes and DOES NOT cancel if already DISPATCHED
     */
    public function test_webhook_records_warning_without_cancelling_when_order_is_dispatched(): void
    {
        $order = $this->createTestOrder(['status' => WcOrderStatus::DISPATCHED]);

        $syncService = app(WooCommerceOrderSyncService::class);
        $updated = $syncService->handleIncomingOrder($this->owner, [
            'id' => $order->wc_order_id,
            'status' => 'cancelled',
        ]);

        $this->assertEquals(WcOrderStatus::DISPATCHED, $updated->status);
        $this->assertEquals(WcOrderStatus::DISPATCHED, $order->fresh()->status);
        $this->assertStringContainsString('تحذير', $order->fresh()->notes);
    }

    /**
     * Commit 9: Webhook cancellation on already RETURNED order does not log warning and keeps status RETURNED
     */
    public function test_webhook_cancellation_on_returned_order_suppresses_warnings(): void
    {
        $order = $this->createTestOrder(['status' => WcOrderStatus::DISPATCHED]);

        $syncService = app(WooCommerceOrderSyncService::class);
        $syncService->returnOrder($this->owner, $order, 'العميل رفض الاستلام');
        $this->assertEquals(WcOrderStatus::RETURNED, $order->fresh()->status);

        $updated = $syncService->handleIncomingOrder($this->owner, [
            'id' => $order->wc_order_id,
            'status' => 'cancelled',
        ]);

        $this->assertEquals(WcOrderStatus::RETURNED, $updated->status);
        $this->assertEquals(WcOrderStatus::RETURNED, $order->fresh()->status);
        $this->assertStringNotContainsString('تحذير', (string) $order->fresh()->notes);
    }

    /**
     * Commit 4: Returning a DELIVERED order throws PosDomainException with RETURN_AFTER_DELIVERY_UNSUPPORTED
     */
    public function test_return_delivered_order_throws_return_after_delivery_unsupported(): void
    {
        $order = $this->createTestOrder(['status' => WcOrderStatus::DELIVERED]);

        $syncService = app(WooCommerceOrderSyncService::class);

        try {
            $syncService->returnOrder($this->owner, $order, 'محاولة إرجاع بعد التسليم');
            $this->fail('Expected PosDomainException was not thrown');
        } catch (PosDomainException $e) {
            $this->assertEquals('RETURN_AFTER_DELIVERY_UNSUPPORTED', $e->getErrorCode());
            $this->assertEquals(422, $e->getStatusCode());
        }
    }

    /**
     * Commit 4: Returning an order reverses active IN_TRANSIT VAN stock transfer
     */
    public function test_return_order_reverses_in_transit_van_transfer(): void
    {
        $vanBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'سيارة المندوب 1',
            'code' => 'VAN-01',
            'type' => BranchType::VAN,
            'is_active' => true,
        ]);

        $mandob = User::create([
            'name' => 'مندوب التوصيل',
            'phone' => '01099998888',
            'password' => bcrypt('password123'),
            'owner_id' => $this->owner->id,
            'branch_id' => $vanBranch->id,
        ]);

        $order = $this->createTestOrder(['status' => WcOrderStatus::CONFIRMED]);

        $syncService = app(WooCommerceOrderSyncService::class);
        $syncService->dispatchToMandob($this->owner, $order, $mandob->id);

        $transfer = StockTransfer::where('user_id', $this->owner->id)
            ->where('notes', 'like', WooCommerceOrderSyncService::buildTransferNotePrefix($order->wc_order_id) . '%')
            ->first();

        $this->assertNotNull($transfer);
        $this->assertEquals(StockTransferStatus::IN_TRANSIT, $transfer->status);

        // Now return the order
        $syncService->returnOrder($this->owner, $order->fresh(), 'العميل رفض الشحنة');

        $this->assertEquals(WcOrderStatus::RETURNED, $order->fresh()->status);
        $this->assertEquals(StockTransferStatus::CANCELLED, $transfer->fresh()->status);
    }

    /**
     * Commit 4: Returning an order with already RECEIVED VAN transfer records warning and does not throw
     */
    public function test_return_order_with_received_van_transfer_records_warning(): void
    {
        $vanBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'سيارة المندوب 2',
            'code' => 'VAN-02',
            'type' => BranchType::VAN,
            'is_active' => true,
        ]);

        $mandob = User::create([
            'name' => 'مندوب التوصيل 2',
            'phone' => '01099998887',
            'password' => bcrypt('password123'),
            'owner_id' => $this->owner->id,
            'branch_id' => $vanBranch->id,
        ]);

        $order = $this->createTestOrder(['status' => WcOrderStatus::CONFIRMED]);

        $syncService = app(WooCommerceOrderSyncService::class);
        $syncService->dispatchToMandob($this->owner, $order, $mandob->id);

        $transfer = StockTransfer::where('user_id', $this->owner->id)
            ->where('notes', 'like', WooCommerceOrderSyncService::buildTransferNotePrefix($order->wc_order_id) . '%')
            ->first();

        $this->assertNotNull($transfer);
        // Simulate transfer was already received by mandob
        $transfer->update(['status' => StockTransferStatus::RECEIVED]);

        // Now return order
        $syncService->returnOrder($this->owner, $order->fresh(), 'مرتجع بعد الاستلام');

        $this->assertEquals(WcOrderStatus::RETURNED, $order->fresh()->status);
        $this->assertEquals(StockTransferStatus::RECEIVED, $transfer->fresh()->status);
        $this->assertStringContainsString('تحذير', $order->fresh()->notes);
    }

    /**
     * Commit 4: Returning order sends cancelled to WooCommerce instead of refunded
     */
    public function test_return_order_sends_cancelled_to_woocommerce_not_refunded(): void
    {
        Queue::fake();

        $order = $this->createTestOrder(['status' => WcOrderStatus::DISPATCHED]);

        $syncService = app(WooCommerceOrderSyncService::class);
        $syncService->returnOrder($this->owner, $order, 'رفض استلام');

        Queue::assertPushed(SyncOrderStatusToWooCommerceJob::class, function ($job) use ($order) {
            return $job->userId === $this->owner->id
                && $job->wcOrderId === $order->wc_order_id
                && $job->status === 'cancelled';
        });
    }

    /**
     * Commit 5: pullRecentOrders paginates until a page has fewer than limit orders
     */
    public function test_pull_recent_orders_paginates_until_page_has_fewer_than_limit(): void
    {
        $mockClient = Mockery::mock(WooCommerceApiClientInterface::class);

        // Page 1 for processing has 3 orders (limit = 3)
        $mockClient->shouldReceive('getOrders')
            ->once()
            ->withArgs(function ($integration, $status, $page, $limit) {
                return $status === 'processing' && $page === 1 && $limit === 3;
            })
            ->andReturn([
                ['id' => 701, 'status' => 'processing', 'total' => 100],
                ['id' => 702, 'status' => 'processing', 'total' => 100],
                ['id' => 703, 'status' => 'processing', 'total' => 100],
            ]);

        // Page 2 for processing has 2 orders (< limit)
        $mockClient->shouldReceive('getOrders')
            ->once()
            ->withArgs(function ($integration, $status, $page, $limit) {
                return $status === 'processing' && $page === 2 && $limit === 3;
            })
            ->andReturn([
                ['id' => 704, 'status' => 'processing', 'total' => 100],
                ['id' => 705, 'status' => 'processing', 'total' => 100],
            ]);

        // pending and on-hold return empty
        $mockClient->shouldReceive('getOrders')
            ->withArgs(function ($integration, $status, $page, $limit) {
                return in_array($status, ['pending', 'on-hold']) && $page === 1;
            })
            ->andReturn([]);

        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);

        $syncService = app(WooCommerceOrderSyncService::class);
        $result = $syncService->pullRecentOrders($this->owner, 3);

        $this->assertEquals(5, $result['imported']);
        $this->assertEquals(5, $result['total']);
    }

    /**
     * Commit 6: Webhook returns unified 401 response on missing or invalid signature
     */
    public function test_webhook_returns_unified_401_on_missing_or_invalid_signature(): void
    {
        $payload = json_encode(['id' => 888, 'status' => 'processing']);

        // 1. Missing signature
        $resMissing = $this->call(
            'POST',
            "/api/webhooks/woocommerce/{$this->owner->id}",
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            $payload
        );
        $resMissing->assertStatus(401);
        $resMissing->assertJson(['message' => 'Unauthorized webhook signature']);

        // 2. Invalid signature
        $resInvalid = $this->call(
            'POST',
            "/api/webhooks/woocommerce/{$this->owner->id}",
            [],
            [],
            [],
            [
                'HTTP_X_WC_WEBHOOK_SIGNATURE' => 'invalid_signature_test',
                'CONTENT_TYPE' => 'application/json',
            ],
            $payload
        );
        $resInvalid->assertStatus(401);
        $resInvalid->assertJson(['message' => 'Unauthorized webhook signature']);
    }
}
