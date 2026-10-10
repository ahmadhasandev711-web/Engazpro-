<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Party;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceProcessTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected string $token;
    protected Product $product;
    protected Party $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'تاجر 1',
            'phone' => '01000000000',
            'password' => bcrypt('password123'),
        ]);

        Subscription::create([
            'user_id' => $this->user->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->token = $this->user->createToken('test_token')->plainTextToken;

        $this->product = Product::create([
            'user_id' => $this->user->id,
            'name' => 'لابتوب ديل',
            'purchase_price' => 10000.00,
            'sale_price' => 12000.00,
            'quantity' => 10,
        ]);

        $this->customer = Party::create([
            'user_id' => $this->user->id,
            'type' => 'CUSTOMER',
            'name' => 'عميل مميز',
            'balance' => 0.00,
        ]);
    }

    public function test_sale_invoice_reduces_stock_and_updates_ledger(): void
    {
        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/invoices', [
                'type' => 'SALE',
                'party_id' => $this->customer->id,
                'date' => now()->toDateString(),
                'discount' => 100.00,
                'paid_amount' => 11900.00, // سداد كامل بعد الخصم
                'items' => [
                    [
                        'product_id' => $this->product->id,
                        'quantity' => 1,
                        'unit_price' => 12000.00,
                    ]
                ]
            ]);

        $response->assertStatus(201)->assertJsonPath('success', true);
        
        $invoiceId = $response->json('data.id');

        // التحقق من أن المخزون قلّ بمقدار 1
        $this->assertDatabaseHas('products', [
            'id' => $this->product->id,
            'quantity' => 9.00,
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $this->product->id,
            'source_type' => 'SALE',
            'type' => 'OUT',
            'quantity' => 1.00,
        ]);

        // التحقق من حساب العميل (بما أنه سدد كامل المبلغ، يجب أن يكون الرصيد صفر في النهاية)
        // يجب أن نجد قيد بيع (مدين) وقيد سداد (دائن)
        $this->assertDatabaseHas('ledger_entries', [
            'party_id' => $this->customer->id,
            'source_type' => 'INVOICE',
            'debit' => 11900.00,
            'credit' => 0.00,
        ]);

        $this->assertDatabaseHas('ledger_entries', [
            'party_id' => $this->customer->id,
            'source_type' => 'PAYMENT',
            'debit' => 0.00,
            'credit' => 11900.00,
        ]);
        
        $this->assertEquals(0.00, Party::find($this->customer->id)->balance);
    }

    public function test_delete_invoice_reverses_stock_and_ledger(): void
    {
        // 1. إنشاء الفاتورة (آجلة)
        $invoiceResponse = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/invoices', [
                'type' => 'SALE',
                'party_id' => $this->customer->id,
                'date' => now()->toDateString(),
                'paid_amount' => 0.00, // آجل بالكامل
                'items' => [
                    [
                        'product_id' => $this->product->id,
                        'quantity' => 2,
                        'unit_price' => 12000.00,
                    ]
                ]
            ]);

        $invoiceId = $invoiceResponse->json('data.id');

        $this->assertEquals(8.00, Product::find($this->product->id)->quantity);
        $this->assertEquals(24000.00, Party::find($this->customer->id)->balance);

        // 2. حذف الفاتورة
        $deleteResponse = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->deleteJson("/api/invoices/{$invoiceId}");

        $deleteResponse->assertStatus(200);

        // 3. التحقق من المرتجعات (العودة للوضع الأصلي)
        $this->assertEquals(10.00, Product::find($this->product->id)->quantity);
        $this->assertEquals(0.00, Party::find($this->customer->id)->balance);

        // التأكد من تسجيل قيود العكس Reversal
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $this->product->id,
            'source_type' => 'REVERSAL',
            'type' => 'IN',
            'quantity' => 2.00,
        ]);

        $this->assertDatabaseHas('ledger_entries', [
            'party_id' => $this->customer->id,
            'source_type' => 'REVERSAL',
            'credit' => 24000.00,
        ]);

        $this->assertSoftDeleted('invoices', ['id' => $invoiceId]);
    }
}
