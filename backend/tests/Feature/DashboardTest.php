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

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Product $product;
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

        $this->product = Product::create([
            'user_id' => $this->user->id,
            'category_id' => $category->id,
            'name' => 'عصير برتقال',
            'code' => 'ORG-01',
            'purchase_price' => 10.00,
            'sale_price' => 20.00,
            'quantity' => 100,
        ]);

        $this->customer = Party::create([
            'user_id' => $this->user->id,
            'type' => 'CUSTOMER',
            'name' => 'سوبرماركت البركة',
            'phone' => '01099999999',
        ]);

        $this->supplier = Party::create([
            'user_id' => $this->user->id,
            'type' => 'SUPPLIER',
            'name' => 'شركة الأهرام للتوزيع',
            'phone' => '01088888888',
        ]);

        $this->invoiceService = app(InvoiceService::class);
        $this->paymentService = app(PaymentService::class);
    }

    public function test_dashboard_returns_correct_kpis_and_cash_flow_for_today(): void
    {
        $today = now()->toDateString();

        // 1. مبيعات كاش اليوم = 200 (10 قطع * 20 جنيه، تكلفة 100)
        $this->invoiceService->createInvoice($this->user, [
            'type' => 'SALE',
            'party_id' => $this->customer->id,
            'payment_method' => 'CASH',
            'date' => $today,
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 10, 'unit_price' => 20.00]
            ],
        ]);

        // 2. سند قبض كاش مستقل = 50
        $this->paymentService->createPayment($this->user, [
            'party_id' => $this->customer->id,
            'type' => 'RECEIPT',
            'amount' => 50.00,
            'method' => 'CASH',
            'date' => $today,
            'notes' => 'دفعة حساب قديم',
        ]);

        // 3. مشتريات كاش اليوم = 80 (8 قطع * 10 جنيه)
        $this->invoiceService->createInvoice($this->user, [
            'type' => 'PURCHASE',
            'party_id' => $this->supplier->id,
            'payment_method' => 'CASH',
            'date' => $today,
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 8, 'unit_price' => 10.00]
            ],
        ]);

        // 4. سند صرف كاش مستقل لمورد = 30
        $this->paymentService->createPayment($this->user, [
            'party_id' => $this->supplier->id,
            'type' => 'PAYMENT',
            'amount' => 30.00,
            'method' => 'CASH',
            'date' => $today,
            'notes' => 'سداد لمورد',
        ]);

        // 5. مصروف كاش اليوم = 20
        Expense::create([
            'user_id' => $this->user->id,
            'title' => 'بنزين دراجة نارية',
            'amount' => 20.00,
            'date' => $today,
            'category' => 'انتقالات',
        ]);

        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/dashboard');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'today',
                    'kpis' => [
                        'today_sales',
                        'today_profit',
                        'today_expenses',
                        'today_cash_flow',
                        'month_sales',
                    ],
                    'cash_flow' => [
                        'inflow' => [
                            'cash_sales',
                            'receipt_vouchers',
                            'purchase_returns',
                            'total',
                        ],
                        'outflow' => [
                            'cash_purchases',
                            'payment_vouchers',
                            'sale_returns',
                            'expenses',
                            'total',
                        ],
                        'net_cash_flow',
                    ],
                    'recent_activities',
                ]
            ]);

        $data = $response->json('data');

        // مبيعات اليوم = 200
        $this->assertEquals(200, $data['kpis']['today_sales']);
        // أرباح اليوم = (200 مبيعات - 100 تكلفة) - 20 مصروفات = 80
        $this->assertEquals(80, $data['kpis']['today_profit']);
        // مصروفات اليوم = 20
        $this->assertEquals(20, $data['kpis']['today_expenses']);

        // الحصيلة النقدية اليومية:
        // الداخل: 200 كاش مبيعات + 50 سند قبض = 250
        $this->assertEquals(250, $data['cash_flow']['inflow']['total']);
        // الخارج: 80 مشتريات كاش + 30 سند صرف + 20 مصروف = 130
        $this->assertEquals(130, $data['cash_flow']['outflow']['total']);
        // الصافي: 250 - 130 = 120
        $this->assertEquals(120, $data['kpis']['today_cash_flow']);
        $this->assertEquals(120, $data['cash_flow']['net_cash_flow']);

        // يجب أن تحتوي recent_activities على 5 حركات كحد أقصى
        $this->assertCount(5, $data['recent_activities']);
    }

    public function test_cash_flow_report_with_custom_date_range(): void
    {
        $yesterday = now()->subDay()->toDateString();
        $today = now()->toDateString();

        // حركة أمس
        $this->invoiceService->createInvoice($this->user, [
            'type' => 'SALE',
            'party_id' => $this->customer->id,
            'payment_method' => 'CASH',
            'date' => $yesterday,
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 5, 'unit_price' => 20.00]
            ],
        ]);

        // حركة اليوم
        $this->invoiceService->createInvoice($this->user, [
            'type' => 'SALE',
            'party_id' => $this->customer->id,
            'payment_method' => 'CASH',
            'date' => $today,
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 10, 'unit_price' => 20.00]
            ],
        ]);

        // فلترة أمس فقط
        $responseYesterday = $this->actingAs($this->user, 'sanctum')
            ->getJson("/api/reports/cash-flow?from_date={$yesterday}&to_date={$yesterday}");

        $responseYesterday->assertStatus(200);
        $this->assertEquals(100, $responseYesterday->json('data.inflow.cash_sales'));
        $this->assertEquals(100, $responseYesterday->json('data.net_cash_flow'));

        // فلترة اليومين معاً
        $responseBoth = $this->actingAs($this->user, 'sanctum')
            ->getJson("/api/reports/cash-flow?from_date={$yesterday}&to_date={$today}");

        $responseBoth->assertStatus(200);
        $this->assertEquals(300, $responseBoth->json('data.inflow.cash_sales'));
        $this->assertEquals(300, $responseBoth->json('data.net_cash_flow'));
    }

    public function test_user_cannot_see_other_user_dashboard_data(): void
    {
        $otherUser = User::factory()->create(['phone' => '01122334455']);
        Subscription::create([
            'user_id' => $otherUser->id,
            'start_date' => now()->subDay(),
            'end_date' => now()->addYear(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        // المستخدم الحالي لديه مبيعات
        $this->invoiceService->createInvoice($this->user, [
            'type' => 'SALE',
            'party_id' => $this->customer->id,
            'payment_method' => 'CASH',
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 10, 'unit_price' => 20.00]
            ],
        ]);

        // المستخدم الآخر يستعلم عن الـ Dashboard
        $response = $this->actingAs($otherUser, 'sanctum')
            ->getJson('/api/dashboard');

        $response->assertStatus(200);
        $this->assertEquals(0, $response->json('data.kpis.today_sales'));
        $this->assertEquals(0, $response->json('data.kpis.today_cash_flow'));
        $this->assertEmpty($response->json('data.recent_activities'));
    }
}
