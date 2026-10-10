<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Expense;
use App\Models\Party;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReturnsPaymentsExpensesTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Category $category;
    protected Product $product;
    protected Party $customer;
    protected Party $supplier;

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

        $this->category = Category::create([
            'user_id' => $this->user->id,
            'name' => 'مواد غذائية',
        ]);

        $this->product = Product::create([
            'user_id' => $this->user->id,
            'category_id' => $this->category->id,
            'name' => 'شيبسي عائلي',
            'code' => 'CHIP-01',
            'purchase_price' => 20.00,
            'sale_price' => 30.00,
            'quantity' => 10,
        ]);

        $this->customer = Party::create([
            'user_id' => $this->user->id,
            'type' => 'CUSTOMER',
            'name' => 'عميل تجريبي',
            'balance' => 1000.00, // عليه 1000
        ]);

        $this->supplier = Party::create([
            'user_id' => $this->user->id,
            'type' => 'SUPPLIER',
            'name' => 'مورد تجريبي',
            'balance' => 1000.00, // له 1000
        ]);
    }

    /**
     * اختبار مرتجع بيع نقدي: الخزينة تنقص (صرف للعميل) والمخزون يزيد
     */
    public function test_sale_return_cash(): void
    {
        $response = $this->actingAs($this->user)->postJson('/api/invoices', [
            'type' => 'SALE_RETURN',
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'paid_amount' => 60.00,
            'payment_method' => 'CASH',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 2,
                    'unit_price' => 30.00, // Total = 60
                ]
            ],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        // تأكيد زيادة المخزون بحركة IN
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $this->product->id,
            'type' => 'IN',
            'source_type' => 'SALE_RETURN',
            'quantity' => 2,
        ]);

        // تأكيد تسجيل سند صرف (PAYMENT) لرد الكاش
        $this->assertDatabaseHas('payments', [
            'user_id' => $this->user->id,
            'party_id' => $this->customer->id,
            'type' => 'PAYMENT',
            'amount' => 60.00,
        ]);
    }

    /**
     * اختبار مرتجع بيع آجل: يقلل مديونية العميل في كشف الحساب والمخزون يزيد
     */
    public function test_sale_return_credit(): void
    {
        $response = $this->actingAs($this->user)->postJson('/api/invoices', [
            'type' => 'SALE_RETURN',
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'paid_amount' => 0.00,
            'payment_method' => 'CREDIT',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 2,
                    'unit_price' => 30.00, // Total = 60
                ]
            ],
        ]);

        $response->assertStatus(201);

        // قيد كشف الحساب دائن (Credit) للعميل بقيمة 60 لتخفيض مديونيته
        $this->assertDatabaseHas('ledger_entries', [
            'party_id' => $this->customer->id,
            'source_type' => 'INVOICE',
            'credit' => 60.00,
            'debit' => 0.00,
        ]);
    }

    /**
     * اختبار مرتجع شراء آجل: يقلل مستحقات المورد والمخزون ينقص
     */
    public function test_purchase_return_credit(): void
    {
        $response = $this->actingAs($this->user)->postJson('/api/invoices', [
            'type' => 'PURCHASE_RETURN',
            'party_id' => $this->supplier->id,
            'date' => now()->toDateString(),
            'paid_amount' => 0.00,
            'payment_method' => 'CREDIT',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 3,
                    'unit_price' => 20.00, // Total = 60
                ]
            ],
        ]);

        $response->assertStatus(201);

        // حركة المخزون خروج OUT
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $this->product->id,
            'type' => 'OUT',
            'source_type' => 'PURCHASE_RETURN',
            'quantity' => 3,
        ]);

        // قيد كشف الحساب مدين (Debit) للمورد بقيمة 60 لتخفيض مستحقاته
        $this->assertDatabaseHas('ledger_entries', [
            'party_id' => $this->supplier->id,
            'source_type' => 'INVOICE',
            'debit' => 60.00,
            'credit' => 0.00,
        ]);
    }

    /**
     * اختبار البحث عن الفاتورة برقمها
     */
    public function test_find_invoice_by_number(): void
    {
        $invoice = $this->actingAs($this->user)->postJson('/api/invoices', [
            'type' => 'SALE',
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'paid_amount' => 30.00,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                    'unit_price' => 30.00,
                ]
            ],
        ])->json('data');

        $response = $this->actingAs($this->user)->getJson("/api/invoices/by-number/{$invoice['invoice_number']}");
        $response->assertStatus(200)
            ->assertJsonPath('data.id', $invoice['id'])
            ->assertJsonPath('data.items.0.product_name', 'شيبسي عائلي');
    }

    /**
     * اختبار سند قبض مستقل من عميل (Receipt Voucher)
     */
    public function test_standalone_receipt_voucher(): void
    {
        $response = $this->actingAs($this->user)->postJson('/api/payments', [
            'party_id' => $this->customer->id,
            'type' => 'RECEIPT',
            'amount' => 400.00,
            'method' => 'CASH',
            'date' => now()->toDateString(),
            'notes' => 'دفعة نقدية تحت الحساب',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        // قيد دائن (Credit) في الـ Ledger
        $this->assertDatabaseHas('ledger_entries', [
            'party_id' => $this->customer->id,
            'source_type' => 'PAYMENT',
            'credit' => 400.00,
            'debit' => 0.00,
        ]);
    }

    /**
     * اختبار سند صرف مستقل لمورد (Payment Voucher)
     */
    public function test_standalone_payment_voucher(): void
    {
        $response = $this->actingAs($this->user)->postJson('/api/payments', [
            'party_id' => $this->supplier->id,
            'type' => 'PAYMENT',
            'amount' => 500.00,
            'method' => 'TRANSFER',
            'date' => now()->toDateString(),
            'notes' => 'تحويل بنكي للمورد',
        ]);

        $response->assertStatus(201);

        // قيد مدين (Debit) في الـ Ledger
        $this->assertDatabaseHas('ledger_entries', [
            'party_id' => $this->supplier->id,
            'source_type' => 'PAYMENT',
            'debit' => 500.00,
            'credit' => 0.00,
        ]);
    }

    /**
     * اختبار إلغاء السند وعكس أثره المحاسبي (Reversal)
     */
    public function test_delete_payment_and_reversal(): void
    {
        $payment = Payment::create([
            'user_id' => $this->user->id,
            'party_id' => $this->customer->id,
            'type' => 'RECEIPT',
            'amount' => 300.00,
            'method' => 'CASH',
            'date' => now()->toDateString(),
        ]);

        $response = $this->actingAs($this->user)->deleteJson("/api/payments/{$payment->id}");
        $response->assertStatus(200);

        $this->assertSoftDeleted('payments', ['id' => $payment->id]);

        // تأكيد تسجيل قيد عكسي REVERSAL
        $this->assertDatabaseHas('ledger_entries', [
            'party_id' => $this->customer->id,
            'source_type' => 'REVERSAL',
            'debit' => 300.00, // عكس الـ Receipt (Credit)
        ]);
    }

    /**
     * اختبار عمليات المصروفات (Expenses CRUD)
     */
    public function test_expenses_crud(): void
    {
        // 1. Create
        $response = $this->actingAs($this->user)->postJson('/api/expenses', [
            'title' => 'بنزين سيارة التوزيع',
            'category' => 'وقود',
            'amount' => 150.00,
            'date' => now()->toDateString(),
            'notes' => 'تفويلة للمندوب',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.title', 'بنزين سيارة التوزيع');

        $expenseId = $response->json('data.id');

        // 2. Index + Summary
        $indexResponse = $this->actingAs($this->user)->getJson('/api/expenses');
        $indexResponse->assertStatus(200)
            ->assertJsonPath('summary.total_amount', 150);

        // 3. Update
        $updateResponse = $this->actingAs($this->user)->putJson("/api/expenses/{$expenseId}", [
            'title' => 'بنزين سيارة التوزيع - معدل',
            'category' => 'وقود',
            'amount' => 200.00,
            'date' => now()->toDateString(),
        ]);
        $updateResponse->assertStatus(200)
            ->assertJsonPath('data.amount', 200);

        // 4. Delete
        $deleteResponse = $this->actingAs($this->user)->deleteJson("/api/expenses/{$expenseId}");
        $deleteResponse->assertStatus(200);

        $this->assertSoftDeleted('expenses', ['id' => $expenseId]);
    }
}
