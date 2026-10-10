<?php

namespace Tests\Feature;

use App\Models\Party;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use App\Services\InvoiceService;
use App\Services\LedgerService;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceAndStockTest extends TestCase
{
    use RefreshDatabase;

    public function test_invoice_creation_updates_stock_and_ledger_consistently(): void
    {
        // 1. إنشاء مستخدم مع اشتراك نشط
        $user = User::create([
            'name' => 'تاجر تجريبي',
            'phone' => '01000000001',
            'password' => bcrypt('password123'),
        ]);

        Subscription::create([
            'user_id' => $user->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        // 2. إضافة منتج برصيد أولي 10 قطع
        $product = Product::create([
            'user_id' => $user->id,
            'name' => 'صنف أ',
            'purchase_price' => 50.00,
            'sale_price' => 80.00,
            'quantity' => 10.00,
        ]);

        // 3. إضافة عميل
        $customer = Party::create([
            'user_id' => $user->id,
            'type' => 'CUSTOMER',
            'name' => 'عميل تجريبي',
            'balance' => 0.00,
        ]);

        // 4. إنشاء فاتورة بيع لقطعتين على الحساب (آجل)
        $stockService = new StockService();
        $ledgerService = new LedgerService();
        $invoiceService = new InvoiceService($stockService, $ledgerService);

        $invoice = $invoiceService->createInvoice($user, [
            'type' => 'SALE',
            'party_id' => $customer->id,
            'payment_method' => 'CREDIT',
            'paid_amount' => 0,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'unit_price' => 80.00,
                ]
            ]
        ]);

        // التأكد من صحة الفاتورة
        $this->assertEquals(160.00, $invoice->total);
        $this->assertEquals(160.00, $invoice->remaining_amount);

        // التأكد من خصم المخزون وتسجيل حركة المخزون
        $product->refresh();
        $this->assertEquals(8.00, $product->quantity);

        $this->assertDatabaseHas('stock_movements', [
            'user_id' => $user->id,
            'product_id' => $product->id,
            'type' => 'OUT',
            'quantity' => 2.00,
            'balance_after' => 8.00,
        ]);

        // التأكد من تحديث رصيد العميل وتسجيل قيد كشف الحساب
        $customer->refresh();
        $this->assertEquals(160.00, $customer->balance);

        $this->assertDatabaseHas('ledger_entries', [
            'user_id' => $user->id,
            'party_id' => $customer->id,
            'debit' => 160.00,
            'credit' => 0.00,
            'balance_after' => 160.00,
        ]);
    }
}
