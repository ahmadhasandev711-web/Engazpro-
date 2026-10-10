<?php

namespace Tests\Feature;

use App\Enums\LedgerSource;
use App\Models\Category;
use App\Models\Invoice;
use App\Models\Party;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use App\Services\DashboardService;
use App\Services\InvoiceService;
use App\Services\LedgerService;
use App\Services\PartyService;
use App\Services\ProductService;
use App\Services\ReportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PerformanceAndDbOptimizationPhase3Test extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Party $customer;
    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create([
            'role' => 'OWNER',
            'status' => 'ACTIVE',
        ]);

        Subscription::create([
            'user_id' => $this->user->id,
            'start_date' => now()->subDay(),
            'end_date' => now()->addYear(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->category = Category::create([
            'user_id' => $this->user->id,
            'name' => 'تصنيف الاختبارات',
        ]);

        $this->customer = Party::create([
            'user_id' => $this->user->id,
            'type' => 'CUSTOMER',
            'name' => 'عميل اختبار الأداء',
            'phone' => '01011112222',
            'balance' => 0.00,
        ]);
    }

    /**
     * [P1] Verify Product list withExists prevents N+1 query explosion
     */
    public function test_product_list_uses_with_exists_and_avoids_n_plus_one_queries(): void
    {
        $productService = app(ProductService::class);

        // Create 10 products
        for ($i = 1; $i <= 10; $i++) {
            $productService->createProduct($this->user, [
                'name' => "منتج اختبار {$i}",
                'code' => "PRD-{$i}",
                'barcode' => "100000{$i}",
                'category_id' => $this->category->id,
                'quantity' => 10,
                'sale_price' => 50,
                'purchase_price' => 30,
            ]);
        }

        // Query products paginated and serialize through Resource
        DB::enableQueryLog();
        DB::flushQueryLog();

        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/products');

        $response->assertStatus(200);
        $products = $response->json('data');
        $this->assertCount(10, $products);

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        // Check that has_movements is present and correct
        foreach ($products as $p) {
            $this->assertArrayHasKey('has_movements', $p);
        }

        // Without N+1, the total queries for pagination + exists subqueries is small (typically <= 5),
        // whereas with N+1 it would be 2 * 10 = 20 additional queries just for has_movements.
        $this->assertLessThanOrEqual(10, count($queries), 'Product list query count exceeded expected non-N+1 threshold.');
    }

    /**
     * [P1] Verify Party list withExists prevents N+1 queries
     */
    public function test_party_list_uses_with_exists_and_avoids_n_plus_one_queries(): void
    {
        $partyService = app(PartyService::class);

        for ($i = 1; $i <= 10; $i++) {
            $partyService->createParty($this->user, [
                'name' => "طرف اختبار {$i}",
                'type' => 'CUSTOMER',
                'phone' => "010200000{$i}",
            ]);
        }

        DB::enableQueryLog();
        DB::flushQueryLog();

        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/parties');

        $response->assertStatus(200);
        $parties = $response->json('data');
        $this->assertGreaterThanOrEqual(10, count($parties));

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        foreach ($parties as $party) {
            $this->assertArrayHasKey('has_transactions', $party);
        }

        $this->assertLessThanOrEqual(10, count($queries), 'Party list query count exceeded expected non-N+1 threshold.');
    }

    /**
     * [P2] Verify ReportService sales and stock reports with database aggregation
     */
    public function test_report_service_sales_and_stock_aggregation(): void
    {
        $productService = app(ProductService::class);
        $invoiceService = app(InvoiceService::class);
        $reportService = app(ReportService::class);

        $product = $productService->createProduct($this->user, [
            'name' => 'صنف تقرير',
            'code' => 'REP-01',
            'barcode' => '7770001',
            'category_id' => $this->category->id,
            'quantity' => 100,
            'sale_price' => 50,
            'purchase_price' => 30,
            'min_quantity' => 20,
        ]);

        $today = now()->toDateString();

        // 1. Create Sale Invoice: total = 100, shipping = 20, paid = 120
        $invoiceService->createInvoice($this->user, [
            'type' => 'SALE',
            'party_id' => $this->customer->id,
            'payment_method' => 'CASH',
            'date' => $today,
            'shipping_amount' => 20.00,
            'paid_amount' => 120.00,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2, 'unit_price' => 50.00],
            ],
        ]);

        // 2. Fetch sales report
        $salesReport = $reportService->getSalesReport($this->user, $today, $today);

        $this->assertEquals(120.0, $salesReport['total_sales']);
        $this->assertEquals(20.0, $salesReport['total_shipping']);
        $this->assertEquals(120.0, $salesReport['sales_paid']);
        $this->assertEquals(0.0, $salesReport['sales_remaining']);
        $this->assertNotEmpty($salesReport['payment_methods']);

        // 3. Fetch stock report
        $stockReport = $reportService->getStockReport($this->user);
        $this->assertArrayHasKey('summary', $stockReport);
        $this->assertArrayHasKey('products', $stockReport);
        $this->assertGreaterThanOrEqual(1, $stockReport['summary']['products_count']);
    }

    /**
     * [P4] Verify DashboardService caching mechanism and clearCache
     */
    public function test_dashboard_service_cache_and_clear_cache(): void
    {
        $dashboardService = app(DashboardService::class);

        // Fetch dashboard data
        $data1 = $dashboardService->getDashboardData($this->user);
        $this->assertIsArray($data1);
        $this->assertArrayHasKey('kpis', $data1);

        // Clear cache
        $dashboardService->clearCache($this->user);
        $data2 = $dashboardService->getDashboardData($this->user);
        $this->assertIsArray($data2);
    }

    /**
     * [P5] Verify LedgerSource enum and LedgerService accepts enum
     */
    public function test_ledger_source_enum_and_ledger_service_accepts_enum(): void
    {
        $ledgerService = app(LedgerService::class);

        $entry = $ledgerService->recordEntry(
            $this->user,
            $this->customer,
            LedgerSource::REVERSAL,
            null,
            now()->toDateString(),
            'قيد تسوية عكسي اختباري',
            50.0,
            0.0
        );

        $this->assertEquals('REVERSAL', $entry->source_type);
        $this->assertEquals(50.0, (float) $this->customer->fresh()->balance);

        $entryShipping = $ledgerService->recordEntry(
            $this->user,
            $this->customer,
            LedgerSource::SHIPPING,
            null,
            now()->toDateString(),
            'قيد أتعاب شحن اختباري',
            0.0,
            20.0
        );

        $this->assertEquals('SHIPPING', $entryShipping->source_type);
        $this->assertEquals(30.0, (float) $this->customer->fresh()->balance);
    }
}
