<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Expense;
use App\Models\Party;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use App\Services\InvoiceService;
use App\Services\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportsAndLedgerTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Product $productA;
    protected Product $productB;
    protected Party $customer;
    protected Party $supplier;
    protected InvoiceService $invoiceService;
    protected PaymentService $paymentService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create([
            'phone' => '01012345678',
        ]);

        Subscription::create([
            'user_id' => $this->user->id,
            'start_date' => now()->subDay(),
            'end_date' => now()->addYear(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $category = Category::create([
            'user_id' => $this->user->id,
            'name' => 'عام',
        ]);

        // منتج 1: شراء 10، بيع 15، رصيد 100
        $this->productA = Product::create([
            'user_id' => $this->user->id,
            'category_id' => $category->id,
            'name' => 'بيبسي كانز',
            'code' => 'PEP-01',
            'purchase_price' => 10.00,
            'sale_price' => 15.00,
            'quantity' => 100,
            'min_quantity' => 10,
        ]);

        // منتج 2: شراء 50، بيع 80، رصيد 5 (نواقص)
        $this->productB = Product::create([
            'user_id' => $this->user->id,
            'category_id' => $category->id,
            'name' => 'زيت زيتون',
            'code' => 'OIL-01',
            'purchase_price' => 50.00,
            'sale_price' => 80.00,
            'quantity' => 5,
            'min_quantity' => 10,
        ]);

        $this->customer = Party::create([
            'user_id' => $this->user->id,
            'type' => 'CUSTOMER',
            'name' => 'أحمد محمود',
            'balance' => 0.00,
        ]);

        $this->supplier = Party::create([
            'user_id' => $this->user->id,
            'type' => 'SUPPLIER',
            'name' => 'شركة الأهرام للتوزيع',
            'balance' => 0.00,
        ]);

        $this->invoiceService = app(InvoiceService::class);
        $this->paymentService = app(PaymentService::class);
    }

    public function test_profit_report_calculates_gross_sales_cogs_and_net_profit_accurately(): void
    {
        // 1. فاتورة بيع: 10 قطع بيبسي بسعر 15 = 150 (التكلفة = 10 * 10 = 100)
        $saleInvoice = $this->invoiceService->createInvoice($this->user, [
            'type' => 'SALE',
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'payment_method' => 'CREDIT',
            'paid_amount' => 0,
            'items' => [
                [
                    'product_id' => $this->productA->id,
                    'quantity' => 10,
                    'unit_price' => 15.00,
                ],
            ],
        ]);

        // 2. فاتورة مرتجع بيع: 2 قطع بيبسي بسعر 15 = 30 (التكلفة المسترجعة = 2 * 10 = 20)
        $returnInvoice = $this->invoiceService->createInvoice($this->user, [
            'type' => 'SALE_RETURN',
            'party_id' => $this->customer->id,
            'parent_invoice_id' => $saleInvoice->id,
            'date' => now()->toDateString(),
            'payment_method' => 'CREDIT',
            'paid_amount' => 0,
            'items' => [
                [
                    'product_id' => $this->productA->id,
                    'quantity' => 2,
                    'unit_price' => 15.00,
                ],
            ],
        ]);

        // 3. مصروف: 10 جنيه بنزين
        Expense::create([
            'user_id' => $this->user->id,
            'title' => 'بنزين سيارة التوزيع',
            'category' => 'بنزين وانتقالات',
            'amount' => 10.00,
            'date' => now()->toDateString(),
        ]);

        // الحسابات المتوقعة:
        // إجمالي المبيعات = 150
        // مرتجع المبيعات = 30
        // صافي المبيعات = 120
        // تكلفة البضاعة المباعة (Sales COGS) = 100
        // تكلفة البضاعة المرتجعة (Return COGS) = 20
        // صافي التكلفة (Net COGS) = 80
        // إجمالي الربح (Gross Profit) = 120 - 80 = 40
        // المصروفات = 10
        // صافي الربح (Net Profit) = 40 - 10 = 30

        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/reports/profit');

        $response->assertStatus(200)
            ->assertJsonPath('data.sales.gross_sales', 150)
            ->assertJsonPath('data.sales.sale_returns', 30)
            ->assertJsonPath('data.sales.net_sales', 120)
            ->assertJsonPath('data.cogs.cogs_sales', 100)
            ->assertJsonPath('data.cogs.cogs_returns', 20)
            ->assertJsonPath('data.cogs.net_cogs', 80)
            ->assertJsonPath('data.profit.gross_profit', 40)
            ->assertJsonPath('data.profit.total_expenses', 10)
            ->assertJsonPath('data.profit.net_profit', 30);
    }

    public function test_ledger_statement_returns_chronological_entries_and_running_balance(): void
    {
        // 1. مبيعات آجلة بـ 500 (مدين +500، رصيد العميل 500)
        $this->invoiceService->createInvoice($this->user, [
            'type' => 'SALE',
            'party_id' => $this->customer->id,
            'date' => '2026-08-01',
            'payment_method' => 'CREDIT',
            'paid_amount' => 0,
            'items' => [
                [
                    'product_id' => $this->productA->id,
                    'quantity' => 10,
                    'unit_price' => 50.00,
                ],
            ],
        ]);

        // 2. سند قبض نقدي 200 (دائن -200، رصيد العميل 300)
        $this->paymentService->createPayment($this->user, [
            'party_id' => $this->customer->id,
            'type' => 'RECEIPT',
            'amount' => 200.00,
            'method' => 'CASH',
            'date' => '2026-08-02',
            'notes' => 'دفعة نقدية تحت الحساب',
        ]);

        // 3. مرتجع بيع بـ 50 (دائن -50، رصيد العميل 250)
        $this->invoiceService->createInvoice($this->user, [
            'type' => 'SALE_RETURN',
            'party_id' => $this->customer->id,
            'date' => '2026-08-03',
            'payment_method' => 'CREDIT',
            'paid_amount' => 0,
            'items' => [
                [
                    'product_id' => $this->productA->id,
                    'quantity' => 1,
                    'unit_price' => 50.00,
                ],
            ],
        ]);

        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson("/api/ledger/{$this->customer->id}");

        $response->assertStatus(200)
            ->assertJsonPath('data.party.name', 'أحمد محمود')
            ->assertJsonPath('data.summary.total_debit', 500)
            ->assertJsonPath('data.summary.total_credit', 250)
            ->assertJsonPath('data.summary.current_balance', 250)
            ->assertJsonCount(3, 'data.entries');
    }

    public function test_stock_report_calculates_cost_and_retail_valuation_and_low_stock(): void
    {
        // productA: qty=100, cost=10, retail=15 -> cost_val=1000, retail_val=1500, min_qty=10 (not low)
        // productB: qty=5, cost=50, retail=80 -> cost_val=250, retail_val=400, min_qty=10 (low stock!)

        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/reports/stock');

        $response->assertStatus(200)
            ->assertJsonPath('data.summary.products_count', 2)
            ->assertJsonPath('data.summary.total_quantity', 105)
            ->assertJsonPath('data.summary.total_cost_value', 1250)
            ->assertJsonPath('data.summary.total_retail_value', 1900)
            ->assertJsonPath('data.summary.low_stock_count', 1);
    }

    public function test_cash_flow_transactions_returns_paginated_data_for_channel(): void
    {
        // 1. Create Cash Sale
        $this->invoiceService->createInvoice($this->user, [
            'type' => 'SALE',
            'party_id' => $this->customer->id,
            'date' => '2026-08-01',
            'payment_method' => 'CASH',
            'paid_amount' => 150.00,
            'items' => [
                [
                    'product_id' => $this->productA->id,
                    'quantity' => 10,
                    'unit_price' => 15.00,
                ],
            ],
        ]);

        // 2. Create Cash Expense
        Expense::create([
            'user_id' => $this->user->id,
            'created_by' => $this->user->id,
            'title' => 'فاتورة كهرباء',
            'category' => 'مرافق',
            'amount' => 50.00,
            'payment_method' => 'CASH',
            'date' => '2026-08-01',
        ]);

        // 3. Create InstaPay Sale
        $this->invoiceService->createInvoice($this->user, [
            'type' => 'SALE',
            'party_id' => $this->customer->id,
            'date' => '2026-08-01',
            'payment_method' => 'INSTAPAY',
            'paid_amount' => 220.00,
            'items' => [
                [
                    'product_id' => $this->productA->id,
                    'quantity' => 10,
                    'unit_price' => 22.00,
                ],
            ],
        ]);

        // Fetch Cash Transactions
        $responseCash = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/reports/cash-flow/transactions?channel=CASH');

        $responseCash->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('meta.total', 2)
            ->assertJsonCount(2, 'data');

        // Fetch InstaPay Transactions
        $responseInstapay = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/reports/cash-flow/transactions?channel=INSTAPAY');

        $responseInstapay->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.amount', 220);
    }

    public function test_cash_flow_transactions_filters_by_flow_type_and_movement(): void
    {
        // 1. Cash Sale
        $this->invoiceService->createInvoice($this->user, [
            'type' => 'SALE',
            'party_id' => $this->customer->id,
            'date' => '2026-08-01',
            'payment_method' => 'CASH',
            'paid_amount' => 300.00,
            'items' => [
                [
                    'product_id' => $this->productA->id,
                    'quantity' => 20,
                    'unit_price' => 15.00,
                ],
            ],
        ]);

        // 2. Cash Expense
        Expense::create([
            'user_id' => $this->user->id,
            'created_by' => $this->user->id,
            'title' => 'بنزين سيارة',
            'category' => 'انتقالات',
            'amount' => 80.00,
            'payment_method' => 'CASH',
            'date' => '2026-08-01',
        ]);

        // Filter Inflow
        $resInflow = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/reports/cash-flow/transactions?channel=CASH&flow_type=INFLOW');

        $resInflow->assertStatus(200)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.movement_category', 'SALE')
            ->assertJsonPath('data.0.flow_direction', 'IN');

        // Filter Outflow
        $resOutflow = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/reports/cash-flow/transactions?channel=CASH&flow_type=OUTFLOW');

        $resOutflow->assertStatus(200)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.movement_category', 'EXPENSE')
            ->assertJsonPath('data.0.flow_direction', 'OUT');

        // Filter Movement Category
        $resCat = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/reports/cash-flow/transactions?channel=CASH&movement_category=EXPENSE');

        $resCat->assertStatus(200)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.reference_number', 'بنزين سيارة');
    }
}
