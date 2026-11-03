<?php

namespace Tests\Feature;

use App\Contracts\WooCommerceApiClientInterface;
use App\Enums\BranchType;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Exceptions\WooCommerceConnectionException;
use App\Jobs\PushStockToWooCommerceJob;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WcOrderItem;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WooCommerceBulkStockPushService;
use App\Services\WooCommerce\WooStockPushService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class WooCommerceUnifiedStockPushTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $storeBranch;
    protected WooCommerceIntegration $integration;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => 'OWNER']);
        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now(),
            'end_date' => now()->addYear(),
            'status' => 'ACTIVE',
            'plan' => 'ANNUAL',
            'price' => 1000,
        ]);
        $this->storeBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع المعادي',
            'code' => 'BR-01',
            'type' => BranchType::STORE->value,
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->integration = WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://test-shop.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'is_active' => true,
            'auto_sync_stock' => true,
            'online_branch_id' => null, // tests dynamic store+warehouse fallback
        ]);

        Queue::fake([PushStockToWooCommerceJob::class]);
    }

    /**
     * Requirement (a): Single product push sends branch stock (10) minus reserved (2) = 8.
     */
    public function test_single_product_push_deducts_active_stock_reservation(): void
    {
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف تجريبي بسيط',
            'wc_product_id' => 1001,
            'price' => 100,
            'cost_price' => 60,
            'quantity' => 10,
        ]);

        BranchStock::create([
            'branch_id' => $this->storeBranch->id,
            'product_id' => $product->id,
            'quantity' => 10,
        ]);

        $order = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 9001,
            'branch_id' => $this->storeBranch->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'total' => 200,
        ]);

        WcOrderItem::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => $order->id,
            'product_id' => $product->id,
            'wc_product_id' => 1001,
            'quantity' => '2.00',
        ]);

        $pushedProductCalls = [];

        $mockClient = $this->createMock(WooCommerceApiClientInterface::class);
        $mockClient->method('updateProductStock')
            ->willReturnCallback(function ($integration, $wcProductId, $stock) use (&$pushedProductCalls) {
                $pushedProductCalls[] = [
                    'wc_product_id' => $wcProductId,
                    'stock' => $stock,
                ];
                return true;
            });

        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);

        $response = $this->actingAs($this->owner)
            ->postJson("/api/woocommerce/products/{$product->id}/push-stock");

        $response->assertOk();
        $this->assertCount(1, $pushedProductCalls);
        $this->assertSame(1001, $pushedProductCalls[0]['wc_product_id']);
        $this->assertSame(8.0, $pushedProductCalls[0]['stock']);
    }

    /**
     * Requirement (b): Bulk push sends branch stock (10) minus reserved (2) = 8.
     */
    public function test_bulk_stock_push_deducts_active_stock_reservation(): void
    {
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف مزامنة جماعية',
            'wc_product_id' => 1002,
            'price' => 150,
            'cost_price' => 90,
            'quantity' => 10,
        ]);

        BranchStock::create([
            'branch_id' => $this->storeBranch->id,
            'product_id' => $product->id,
            'quantity' => 10,
        ]);

        $order = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 9002,
            'branch_id' => $this->storeBranch->id,
            'status' => WcOrderStatus::CONFIRMED,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'total' => 300,
        ]);

        WcOrderItem::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => $order->id,
            'product_id' => $product->id,
            'wc_product_id' => 1002,
            'quantity' => '2.00',
        ]);

        $pushedCalls = [];

        $mockClient = $this->createMock(WooCommerceApiClientInterface::class);
        $mockClient->method('updateProductStock')
            ->willReturnCallback(function ($integration, $wcProductId, $stock) use (&$pushedCalls) {
                $pushedCalls[] = [
                    'wc_product_id' => $wcProductId,
                    'stock' => $stock,
                ];
                return true;
            });

        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);

        $bulkService = $this->app->make(WooCommerceBulkStockPushService::class);
        $result = $bulkService->pushAll($this->owner, $this->integration);

        $this->assertSame(1, $result['synced_count']);
        $this->assertEmpty($result['errors']);
        $this->assertCount(1, $pushedCalls);
        $this->assertSame(1002, $pushedCalls[0]['wc_product_id']);
        $this->assertSame(8.0, $pushedCalls[0]['stock']);
    }

    /**
     * Requirement (c): Variable product with variants A (5 stock, 1 reserved) and B (3 stock, 0 reserved):
     * A = 4, B = 3, and parent receives NOTHING in both single push and bulk push.
     */
    public function test_variable_product_pushes_only_variations_and_never_parent(): void
    {
        $parent = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'تيشيرت بمتغيرات',
            'wc_product_id' => 2001,
            'price' => 200,
            'cost_price' => 100,
            'quantity' => 8,
            'has_variants' => true,
        ]);

        $variantA = ProductVariant::create([
            'user_id' => $this->owner->id,
            'product_id' => $parent->id,
            'name' => 'مقاس أحمر',
            'wc_variation_id' => 3001,
            'price' => 200,
            'cost_price' => 100,
            'quantity' => 5,
        ]);

        $variantB = ProductVariant::create([
            'user_id' => $this->owner->id,
            'product_id' => $parent->id,
            'name' => 'مقاس أزرق',
            'wc_variation_id' => 3002,
            'price' => 200,
            'cost_price' => 100,
            'quantity' => 3,
        ]);

        BranchStock::create([
            'branch_id' => $this->storeBranch->id,
            'product_id' => $parent->id,
            'product_variant_id' => $variantA->id,
            'quantity' => 5,
        ]);

        BranchStock::create([
            'branch_id' => $this->storeBranch->id,
            'product_id' => $parent->id,
            'product_variant_id' => $variantB->id,
            'quantity' => 3,
        ]);

        // Reserve 1 item from Variant A
        $order = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 9003,
            'branch_id' => $this->storeBranch->id,
            'status' => WcOrderStatus::PREPARING,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'total' => 200,
        ]);

        WcOrderItem::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => $order->id,
            'product_id' => $parent->id,
            'product_variant_id' => $variantA->id,
            'wc_product_id' => 2001,
            'wc_variation_id' => 3001,
            'quantity' => '1.00',
        ]);

        $parentPushes = [];
        $variationPushes = [];

        $mockClient = $this->createMock(WooCommerceApiClientInterface::class);
        $mockClient->method('updateProductStock')
            ->willReturnCallback(function ($integration, $wcProductId, $stock) use (&$parentPushes) {
                $parentPushes[] = ['wc_product_id' => $wcProductId, 'stock' => $stock];
                return true;
            });
        $mockClient->method('updateVariationStock')
            ->willReturnCallback(function ($integration, $wcProductId, $wcVariationId, $stock) use (&$variationPushes) {
                $variationPushes[] = [
                    'wc_product_id' => $wcProductId,
                    'wc_variation_id' => $wcVariationId,
                    'stock' => $stock,
                ];
                return true;
            });

        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);

        // 1. Single Push
        $response = $this->actingAs($this->owner)
            ->postJson("/api/woocommerce/products/{$parent->id}/push-stock");
        $response->assertOk();

        $this->assertEmpty($parentPushes, 'Parent product must never receive stock push when variants exist (single push)');
        $this->assertSame([
            ['wc_product_id' => 2001, 'wc_variation_id' => 3001, 'stock' => 4.0],
            ['wc_product_id' => 2001, 'wc_variation_id' => 3002, 'stock' => 3.0],
        ], $variationPushes);

        // Reset recordings for Bulk Push
        $parentPushes = [];
        $variationPushes = [];

        // 2. Bulk Push
        $bulkService = $this->app->make(WooCommerceBulkStockPushService::class);
        $bulkResult = $bulkService->pushAll($this->owner, $this->integration);

        $this->assertSame(1, $bulkResult['synced_count']);
        $this->assertEmpty($parentPushes, 'Parent product must never receive stock push when variants exist (bulk push)');
        $this->assertSame([
            ['wc_product_id' => 2001, 'wc_variation_id' => 3001, 'stock' => 4.0],
            ['wc_product_id' => 2001, 'wc_variation_id' => 3002, 'stock' => 3.0],
        ], $variationPushes);
    }

    /**
     * Requirement (d): Unified parity across all 3 execution paths:
     * Job, Single Sync, and Bulk Sync on identical data MUST send identical quantities.
     */
    public function test_unified_parity_across_job_single_and_bulk_push(): void
    {
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف مقارنة المسارات',
            'wc_product_id' => 4001,
            'price' => 80,
            'cost_price' => 40,
            'quantity' => 15,
        ]);

        BranchStock::create([
            'branch_id' => $this->storeBranch->id,
            'product_id' => $product->id,
            'quantity' => 15,
        ]);

        $order = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 9004,
            'branch_id' => $this->storeBranch->id,
            'status' => WcOrderStatus::SHIPPED_VIA_COURIER,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'total' => 160,
        ]);

        WcOrderItem::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => $order->id,
            'product_id' => $product->id,
            'wc_product_id' => 4001,
            'quantity' => '5.00',
        ]);

        $callsJob = [];
        $callsSingle = [];
        $callsBulk = [];

        // 1. Run Job
        $mockClientJob = $this->createMock(WooCommerceApiClientInterface::class);
        $mockClientJob->method('updateProductStock')
            ->willReturnCallback(function ($integration, $wcProductId, $stock) use (&$callsJob) {
                $callsJob[] = $stock;
                return true;
            });
        $this->app->instance(WooCommerceApiClientInterface::class, $mockClientJob);

        $job = new PushStockToWooCommerceJob($this->owner->id, $product->id);
        $this->app->call([$job, 'handle']);

        // 2. Run Single Push (Controller)
        $mockClientSingle = $this->createMock(WooCommerceApiClientInterface::class);
        $mockClientSingle->method('updateProductStock')
            ->willReturnCallback(function ($integration, $wcProductId, $stock) use (&$callsSingle) {
                $callsSingle[] = $stock;
                return true;
            });
        $this->app->instance(WooCommerceApiClientInterface::class, $mockClientSingle);

        $this->actingAs($this->owner)->postJson("/api/woocommerce/products/{$product->id}/push-stock")->assertOk();

        // 3. Run Bulk Push
        $mockClientBulk = $this->createMock(WooCommerceApiClientInterface::class);
        $mockClientBulk->method('updateProductStock')
            ->willReturnCallback(function ($integration, $wcProductId, $stock) use (&$callsBulk) {
                $callsBulk[] = $stock;
                return true;
            });
        $this->app->instance(WooCommerceApiClientInterface::class, $mockClientBulk);

        $bulkService = $this->app->make(WooCommerceBulkStockPushService::class);
        $bulkService->pushAll($this->owner, $this->integration);

        $this->assertSame([10.0], $callsJob);
        $this->assertSame($callsJob, $callsSingle, 'Single push stock quantity must exactly match Job');
        $this->assertSame($callsJob, $callsBulk, 'Bulk push stock quantity must exactly match Job');
    }

    /**
     * Requirement (e): When API returns false:
     * - Job throws WooCommerceConnectionException.
     * - Bulk Push logs error for the failing product and continues remaining products.
     */
    public function test_api_failure_throws_in_job_and_aggregates_in_bulk_push(): void
    {
        $product1 = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف يفشل في الـ API',
            'wc_product_id' => 5001,
            'price' => 50,
            'cost_price' => 25,
            'quantity' => 10,
        ]);
        BranchStock::create([
            'branch_id' => $this->storeBranch->id,
            'product_id' => $product1->id,
            'quantity' => 10,
        ]);

        $product2 = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف ينجح في الـ API',
            'wc_product_id' => 5002,
            'price' => 70,
            'cost_price' => 35,
            'quantity' => 20,
        ]);
        BranchStock::create([
            'branch_id' => $this->storeBranch->id,
            'product_id' => $product2->id,
            'quantity' => 20,
        ]);

        // Job throws on false
        $mockClientJob = $this->createMock(WooCommerceApiClientInterface::class);
        $mockClientJob->method('updateProductStock')->willReturn(false);
        $this->app->instance(WooCommerceApiClientInterface::class, $mockClientJob);

        $job = new PushStockToWooCommerceJob($this->owner->id, $product1->id);

        $jobExceptionThrown = false;
        try {
            $this->app->call([$job, 'handle']);
        } catch (WooCommerceConnectionException $e) {
            $jobExceptionThrown = true;
        }
        $this->assertTrue($jobExceptionThrown, 'PushStockToWooCommerceJob must throw WooCommerceConnectionException on API failure');

        // Bulk push records error for product1 and continues with product2
        $pushedIds = [];
        $mockClientBulk = $this->createMock(WooCommerceApiClientInterface::class);
        $mockClientBulk->method('updateProductStock')
            ->willReturnCallback(function ($integration, $wcProductId, $stock) use (&$pushedIds) {
                $pushedIds[] = $wcProductId;
                return $wcProductId !== 5001; // product 5001 fails, product 5002 succeeds
            });
        $this->app->instance(WooCommerceApiClientInterface::class, $mockClientBulk);

        $bulkService = $this->app->make(WooCommerceBulkStockPushService::class);
        $bulkResult = $bulkService->pushAll($this->owner, $this->integration);

        $this->assertSame(1, $bulkResult['synced_count']);
        $this->assertCount(1, $bulkResult['errors']);
        $this->assertStringContainsString('5001', $bulkResult['errors'][0]);
        $this->assertSame([5001, 5002], $pushedIds);
    }

    /**
     * Requirement (f): PushStockToWooCommerceJob returns silently without exception
     * when integration is inactive or product/variant has no WooCommerce ID.
     */
    public function test_push_stock_job_returns_silently_when_inactive_or_unlinked(): void
    {
        $unlinkedProduct = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف غير مربوط',
            'wc_product_id' => null,
            'price' => 50,
            'cost_price' => 25,
            'quantity' => 10,
        ]);

        $mockClient = $this->createMock(WooCommerceApiClientInterface::class);
        $mockClient->expects($this->never())->method('updateProductStock');
        $mockClient->expects($this->never())->method('updateVariationStock');
        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);

        // Case 1: Product has no wc_product_id
        $job1 = new PushStockToWooCommerceJob($this->owner->id, $unlinkedProduct->id);
        $this->app->call([$job1, 'handle']);

        // Case 2: Integration is inactive
        $linkedProduct = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف مربوط وتكامل معطل',
            'wc_product_id' => 7001,
            'price' => 50,
            'cost_price' => 25,
            'quantity' => 10,
        ]);

        $this->integration->update(['is_active' => false]);

        $job2 = new PushStockToWooCommerceJob($this->owner->id, $linkedProduct->id);
        $this->app->call([$job2, 'handle']);

        $this->assertTrue(true, 'PushStockToWooCommerceJob returned silently without exception');
    }

    /**
     * Guard against wiping stock to 0 when all target branches are inactive.
     */
    public function test_inactive_branches_guards_against_wiping_woocommerce_stock(): void
    {
        $this->storeBranch->update(['is_active' => false]);

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف الفرع المعطل',
            'wc_product_id' => 8888,
            'price' => 50,
            'cost_price' => 25,
            'quantity' => 10,
        ]);

        $mockClient = $this->createMock(WooCommerceApiClientInterface::class);
        $mockClient->expects($this->never())->method('updateProductStock');
        $mockClient->expects($this->never())->method('updateVariationStock');
        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);

        // (أ) الـ Job: صفر استدعاءات API وبدون exception
        $job = new PushStockToWooCommerceJob($this->owner->id, $product->id);
        $this->app->call([$job, 'handle']);

        // (ب) مزامنة الصنف: 422 برفض المزامنة لعدم وجود فروع نشطة
        $response = $this->actingAs($this->owner)
            ->postJson("/api/woocommerce/products/{$product->id}/push-stock");
        $response->assertStatus(422);
        $response->assertJson([
            'message' => 'لا توجد فروع أو مخازن نشطة محددة للمتجر الإلكتروني لسحب الرصيد منها.',
        ]);

        // (ج) مزامنة الكل: صفر استدعاءات وخطأ واحد
        $bulkService = $this->app->make(WooCommerceBulkStockPushService::class);
        $result = $bulkService->pushAll($this->owner, $this->integration);

        $this->assertSame(0, $result['synced_count']);
        $this->assertSame(['لا توجد فروع أو مخازن نشطة محددة للمتجر الإلكتروني لسحب الرصيد منها.'], $result['errors']);
    }
}
