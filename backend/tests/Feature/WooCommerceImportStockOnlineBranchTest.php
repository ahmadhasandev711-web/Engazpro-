<?php

namespace Tests\Feature;

use App\Contracts\WooCommerceApiClientInterface;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WooCommerceProductImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class WooCommerceImportStockOnlineBranchTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $onlineBranch;
    protected WooCommerceIntegration $integration;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => 'OWNER']);
        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->onlineBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع الأونلاين والمستودع',
            'code' => 'BR-ONLINE',
            'is_main' => false,
            'is_active' => true,
        ]);

        $this->integration = WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://mystore.example.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'online_branch_id' => $this->onlineBranch->id,
            'is_active' => true,
        ]);
    }

    public function test_imported_product_initial_stock_is_recorded_under_online_branch(): void
    {
        $mockClient = Mockery::mock(WooCommerceApiClientInterface::class);
        $mockClient->shouldReceive('getProducts')
            ->once()
            ->andReturn([
                [
                    'id' => 12345,
                    'name' => 'قميص صيفي تجريبي',
                    'type' => 'simple',
                    'status' => 'publish',
                    'sku' => 'SHIRT-SUMMER-01',
                    'price' => '150',
                    'regular_price' => '150',
                    'manage_stock' => true,
                    'stock_quantity' => 5,
                    'categories' => [],
                    'images' => [],
                ],
            ]);

        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);

        $importService = $this->app->make(WooCommerceProductImportService::class);
        $result = $importService->importPage($this->owner, $this->integration, 1, 50, true);

        $this->assertEquals(1, $result['imported']);

        $product = Product::where('wc_product_id', 12345)->firstOrFail();

        $branchStock = BranchStock::where('branch_id', $this->onlineBranch->id)
            ->where('product_id', $product->id)
            ->first();

        $this->assertNotNull($branchStock, 'BranchStock must exist for online_branch_id');
        $this->assertEquals(5, (float) $branchStock->quantity);
    }
}
