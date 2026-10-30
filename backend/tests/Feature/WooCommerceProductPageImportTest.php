<?php

namespace Tests\Feature;

use App\Contracts\WooCommerceApiClientInterface;
use App\Enums\QueueName;
use App\Jobs\ImportWooCommerceProductsPageJob;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WooCommerceProductImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Mockery;
use Tests\TestCase;

class WooCommerceProductPageImportTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected WooCommerceIntegration $integration;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create(['role' => 'OWNER']);
        $this->integration = WooCommerceIntegration::create([
            'user_id' => $this->user->id,
            'store_url' => 'https://example.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'is_active' => true,
        ]);
    }

    public function test_import_page_job_dispatches_next_page_when_current_page_is_full(): void
    {
        Queue::fake();

        // إنشاء مصفوفة 50 منتج للصفحة الأولى
        $page1Products = array_map(fn ($i) => [
            'id' => 1000 + $i,
            'name' => "منتج تجريبي {$i}",
            'type' => 'simple',
            'price' => '100',
            'regular_price' => '100',
            'sku' => "SKU-{$i}",
        ], range(1, 50));

        // مصفوفة 10 منتجات فقط للصفحة الثانية (< 50)
        $page2Products = array_map(fn ($i) => [
            'id' => 2000 + $i,
            'name' => "منتج صفحة ثانية {$i}",
            'type' => 'simple',
            'price' => '150',
            'regular_price' => '150',
            'sku' => "SKU-P2-{$i}",
        ], range(1, 10));

        $mockClient = Mockery::mock(\App\Services\WooCommerce\WooCommerceApiClient::class);
        $mockClient->shouldReceive('getProducts')
            ->with(Mockery::any(), 1, 50)
            ->andReturn($page1Products);
        $mockClient->shouldReceive('getProducts')
            ->with(Mockery::any(), 2, 50)
            ->andReturn($page2Products);

        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);
        $this->app->instance(\App\Services\WooCommerce\WooCommerceApiClient::class, $mockClient);

        $importService = app(WooCommerceProductImportService::class);

        // 1. تنفيذ جوب الصفحة الأولى
        $jobPage1 = new ImportWooCommerceProductsPageJob($this->user->id, $this->user->id, 1, false);
        $this->assertSame(QueueName::WOO_BULK->value, $jobPage1->queue);
        $this->assertSame(120, $jobPage1->timeout);

        $jobPage1->handle($importService);

        // يجب عمل dispatch لجوب الصفحة 2
        Queue::assertPushed(ImportWooCommerceProductsPageJob::class, function ($job) {
            return $job->page === 2 && $job->accountId === $this->user->id;
        });

        // 2. تنفيذ جوب الصفحة الثانية (10 أصناف فقط)
        $jobPage2 = new ImportWooCommerceProductsPageJob($this->user->id, $this->user->id, 2, false);
        $jobPage2->handle($importService);

        // لا يجب عمل dispatch لصفحة 3
        Queue::assertNotPushed(ImportWooCommerceProductsPageJob::class, function ($job) {
            return $job->page === 3;
        });
    }
}
