<?php

namespace Tests\Feature;

use App\Jobs\ProcessWooCommerceWebhookJob;
use App\Jobs\PushStockToWooCommerceJob;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WooCommerceApiClient;
use App\Services\WooCommerce\WooCommerceOrderSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Mockery;
use Tests\TestCase;

class TenantQueueContextTest extends TestCase
{
    use RefreshDatabase;

    protected User $ownerA;
    protected User $ownerB;
    protected Branch $branchA;
    protected Branch $branchB;
    protected Product $productB;
    protected WooCommerceIntegration $integrationA;
    protected WooCommerceIntegration $integrationB;

    protected function setUp(): void
    {
        parent::setUp();

        // المتجر A
        $this->ownerA = User::factory()->create(['role' => 'OWNER']);
        Subscription::create([
            'user_id' => $this->ownerA->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);
        $this->branchA = Branch::create([
            'user_id' => $this->ownerA->id,
            'name' => 'فرع متجر أ',
            'code' => 'BR-A',
            'is_main' => true,
            'is_active' => true,
        ]);
        $this->integrationA = WooCommerceIntegration::create([
            'user_id' => $this->ownerA->id,
            'store_url' => 'https://store-a.example.com',
            'consumer_key' => 'ck_a',
            'consumer_secret' => 'cs_a',
            'online_branch_id' => $this->branchA->id,
            'is_active' => true,
            'auto_sync_stock' => true,
        ]);

        // المتجر B
        $this->ownerB = User::factory()->create(['role' => 'OWNER']);
        Subscription::create([
            'user_id' => $this->ownerB->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);
        $this->branchB = Branch::create([
            'user_id' => $this->ownerB->id,
            'name' => 'فرع متجر ب',
            'code' => 'BR-B',
            'is_main' => true,
            'is_active' => true,
        ]);
        $this->integrationB = WooCommerceIntegration::create([
            'user_id' => $this->ownerB->id,
            'store_url' => 'https://store-b.example.com',
            'consumer_key' => 'ck_b',
            'consumer_secret' => 'cs_b',
            'online_branch_id' => $this->branchB->id,
            'is_active' => true,
            'auto_sync_stock' => true,
        ]);

        $this->productB = Product::create([
            'user_id' => $this->ownerB->id,
            'name' => 'منتج متجر ب',
            'purchase_price' => 50,
            'sale_price' => 100,
            'quantity' => 15,
            'wc_product_id' => 777,
        ]);

        BranchStock::create([
            'branch_id' => $this->branchB->id,
            'product_id' => $this->productB->id,
            'quantity' => 15,
        ]);
    }

    public function test_tenant_auth_context_resets_and_does_not_bleed_across_jobs(): void
    {
        $mockSyncService = Mockery::mock(WooCommerceOrderSyncService::class);
        $mockSyncService->shouldReceive('handleIncomingOrder')->once();

        // 1. تنفيذ job المتجر A
        $webhookJob = new ProcessWooCommerceWebhookJob($this->ownerA->id, 'order.created', ['id' => 101]);
        
        // محاكاة خط أنابيب الـ Worker بتطبيق الـ middleware
        $middleware = $webhookJob->middleware();
        $this->assertNotEmpty($middleware, 'ProcessWooCommerceWebhookJob must declare middleware');

        $pipeline = app(\Illuminate\Pipeline\Pipeline::class)
            ->send($webhookJob)
            ->through($middleware)
            ->then(function ($job) use ($mockSyncService) {
                $job->handle($mockSyncService);
            });

        // التأكد من مسح الـ Auth context بعد انتهاء الـ Job
        $this->assertNull(Auth::user(), 'Auth context must be forgotten after job completes');

        // 2. تنفيذ job تحديث المخزون للمتجر B فوراً في نفس العملية
        $mockApiClient = Mockery::mock(WooCommerceApiClient::class);
        $mockApiClient->shouldReceive('updateProductStock')
            ->once()
            ->withArgs(function ($integration, $wcProductId, $stock) {
                return $integration->user_id === $this->ownerB->id
                    && $wcProductId === 777
                    && (float) $stock === 15.0;
            })
            ->andReturn(true);

        $pushJob = new PushStockToWooCommerceJob($this->ownerB->id, $this->productB->id);
        $pushJob->handle($mockApiClient);
    }
}
