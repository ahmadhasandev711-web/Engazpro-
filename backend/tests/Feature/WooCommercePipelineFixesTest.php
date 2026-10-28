<?php

namespace Tests\Feature;

use App\Contracts\WooCommerceApiClientInterface;
use App\Enums\BranchType;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Jobs\SyncOrderStatusToWooCommerceJob;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Invoice;
use App\Models\Party;
use App\Models\Product;
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
            'status' => WcOrderStatus::CONFIRMED,
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
     * Commit 1: Network failure during api update does not affect deliverOrder
     */
    public function test_deliver_order_succeeds_even_when_api_client_fails(): void
    {
        $order = $this->createTestOrder();

        $mockClient = Mockery::mock(WooCommerceApiClientInterface::class);
        $mockClient->shouldReceive('updateOrderStatus')
            ->andThrow(new Exception('Network timeout connecting to WooCommerce'));
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
}
