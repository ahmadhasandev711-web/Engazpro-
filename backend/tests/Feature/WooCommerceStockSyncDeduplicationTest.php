<?php

namespace Tests\Feature;

use App\Jobs\PushStockToWooCommerceJob;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Party;
use App\Models\Product;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\InvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class WooCommerceStockSyncDeduplicationTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $branch;
    protected Product $product;
    protected Party $customer;
    protected WooCommerceIntegration $integration;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => 'OWNER']);
        \App\Models\Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);
        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'BR-01',
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف تجريبي للمزامنة',
            'purchase_price' => 50,
            'sale_price' => 100,
            'quantity' => 20,
            'wc_product_id' => 888,
        ]);

        $this->integration = WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://mystore.example.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'online_branch_id' => $this->branch->id,
            'is_active' => true,
            'auto_sync_stock' => true,
        ]);

        $this->customer = Party::create([
            'user_id' => $this->owner->id,
            'type' => 'CUSTOMER',
            'name' => 'عميل تجريبي',
        ]);

        BranchStock::create([
            'branch_id' => $this->branch->id,
            'product_id' => $this->product->id,
            'quantity' => 20,
        ]);
    }

    public function test_invoice_with_duplicate_product_lines_pushes_stock_sync_job_only_once(): void
    {
        Queue::fake();

        $invoiceService = app(InvoiceService::class);

        // إنشاء الفاتورة
        $invoiceService->createInvoice($this->owner, [
            'type' => 'SALE',
            'party_id' => $this->customer->id,
            'branch_id' => $this->branch->id,
            'payment_method' => 'CASH',
            'paid_amount' => 300,
            'date' => now()->toDateString(),
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                    'unit_price' => 100,
                ],
                [
                    'product_id' => $this->product->id,
                    'quantity' => 2,
                    'unit_price' => 100,
                ],
            ],
        ]);

        // تنفيذ كولباكات afterCommit للمعاملة المكتملة داخل بيئة الاختبار
        if (app()->bound('db.transactions')) {
            app('db.transactions')->getCommittedTransactions()->map->executeCallbacks();
        }

        // يجب أن يُدفع Job واحد فقط لنفس الصنف دون تكرار
        Queue::assertPushed(PushStockToWooCommerceJob::class, 1);
    }

    public function test_save_settings_clears_active_sync_cache(): void
    {
        $cacheKey = "wc_stock_sync_active_{$this->owner->getAccountId()}";
        \Illuminate\Support\Facades\Cache::put($cacheKey, true, 60);

        $this->actingAs($this->owner);

        $response = $this->postJson('/api/woocommerce/settings', [
            'store_url' => 'https://mystore.example.com',
            'auto_sync_stock' => false,
        ]);

        $response->assertOk();
        $this->assertFalse(\Illuminate\Support\Facades\Cache::has($cacheKey));
    }
}
