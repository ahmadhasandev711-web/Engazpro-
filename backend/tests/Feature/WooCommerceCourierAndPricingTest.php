<?php

namespace Tests\Feature;

use App\Enums\PartyType;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Invoice;
use App\Models\Party;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WcOrder;
use App\Services\InvoiceService;
use App\Services\ReportService;
use App\Services\WooCommerce\WooCommerceOrderSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WooCommerceCourierAndPricingTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'صاحب المتجر',
            'phone' => '01000000001',
            'password' => bcrypt('password123'),
        ]);

        Subscription::create([
            'user_id' => $this->user->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->branch = Branch::create([
            'user_id' => $this->user->id,
            'name' => 'المخزن الرئيسي',
            'code' => 'WH-MAIN',
            'type' => 'WAREHOUSE',
            'is_main' => true,
            'is_active' => true,
        ]);
    }

    /**
     * Test regular_price and promotional sale_price on Product
     */
    public function test_product_supports_regular_price_and_promotional_sale_price(): void
    {
        $response = $this->actingAs($this->user)->postJson('/api/products', [
            'name' => 'قميص قطن أزرق',
            'purchase_price' => 100,
            'regular_price' => 200,
            'sale_price' => 150,
            'unit' => 'قطعة',
            'quantity' => 10,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('products', [
            'name' => 'قميص قطن أزرق',
            'regular_price' => 200.00,
            'sale_price' => 150.00,
            'purchase_price' => 100.00,
        ]);
    }

    /**
     * Test that recording a PURCHASE invoice updates the master purchase_price
     * and that subsequent sales compute accurate cost and profit.
     */
    public function test_purchase_invoice_updates_cost_price_and_subsequent_sale_calculates_profit(): void
    {
        // 1. Create a product imported from WooCommerce with cost = 0
        $product = Product::create([
            'user_id' => $this->user->id,
            'name' => 'سماعة بلوتوث',
            'purchase_price' => 0,
            'regular_price' => 300,
            'sale_price' => 250,
            'quantity' => 0,
            'unit' => 'قطعة',
        ]);

        $supplier = Party::create([
            'user_id' => $this->user->id,
            'type' => PartyType::SUPPLIER->value,
            'name' => 'مورد إلكترونيات',
        ]);

        $invoiceService = app(InvoiceService::class);

        // 2. Buy 10 items at cost 120 EGP each via PURCHASE invoice
        $invoiceService->createInvoice($this->user, [
            'type' => 'PURCHASE',
            'party_id' => $supplier->id,
            'branch_id' => $this->branch->id,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 10,
                    'unit_price' => 120.00,
                ],
            ],
            'paid_amount' => 1200.00,
            'payment_method' => 'CASH',
        ]);

        // 3. Verify product master purchase_price was automatically updated to 120.00
        $product->refresh();
        $this->assertEquals(120.00, (float) $product->purchase_price);

        // 4. Make a sale of 2 items at 250 EGP each
        $customer = Party::create([
            'user_id' => $this->user->id,
            'type' => PartyType::CUSTOMER->value,
            'name' => 'عميل تجزئة',
        ]);

        $saleInvoice = $invoiceService->createInvoice($this->user, [
            'type' => 'SALE',
            'party_id' => $customer->id,
            'branch_id' => $this->branch->id,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'unit_price' => 250.00,
                ],
            ],
            'paid_amount' => 500.00,
            'payment_method' => 'CASH',
        ]);

        // Verify purchase_price_at_sale recorded 120.00 per item
        $saleItem = $saleInvoice->items()->first();
        $this->assertEquals(120.00, (float) $saleItem->purchase_price_at_sale);

        // 5. Verify profit report: Revenue 500, COGS 240 (2 * 120), Gross/Net Profit 260
        $reportService = app(ReportService::class);
        $profitReport = $reportService->getProfitReport(now()->toDateString(), now()->toDateString());

        $this->assertEquals(500.00, $profitReport['sales']['gross_sales']);
        $this->assertEquals(240.00, $profitReport['cogs']['net_cogs']);
        $this->assertEquals(260.00, $profitReport['profit']['gross_profit']);
        $this->assertEquals(260.00, $profitReport['profit']['net_profit']);
    }

    /**
     * Test dispatching order to 3rd-party courier and delivering it
     */
    public function test_wc_order_courier_dispatch_and_delivery(): void
    {
        $product = Product::create([
            'user_id' => $this->user->id,
            'name' => 'شنطة ظهر جلد',
            'purchase_price' => 200,
            'sale_price' => 450,
            'quantity' => 5,
            'wc_product_id' => 999,
        ]);

        BranchStock::create([
            'branch_id' => $this->branch->id,
            'product_id' => $product->id,
            'quantity' => 5,
        ]);

        $order = WcOrder::create([
            'user_id' => $this->user->id,
            'wc_order_id' => 8881,
            'branch_id' => $this->branch->id,
            'customer_name' => 'أحمد إبراهيم',
            'customer_phone' => '01012345678',
            'customer_address' => 'الإسكندرية - سموحة',
            'city' => 'الإسكندرية',
            'status' => WcOrderStatus::CONFIRMED,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'shipping_cost' => 50.00,
            'subtotal' => 450.00,
            'total' => 500.00,
            'items_snapshot' => [
                [
                    'product_id' => 999,
                    'name' => 'شنطة ظهر جلد',
                    'quantity' => 1,
                    'price' => 450.00,
                    'total' => 450.00,
                ],
            ],
        ]);

        $courier = Party::create([
            'user_id' => $this->user->id,
            'type' => PartyType::COURIER->value,
            'name' => 'شركة بوسطة للشحن',
            'phone' => '19000',
        ]);

        // Dispatch to courier via API endpoint
        $response = $this->actingAs($this->user)->postJson("/api/wc-orders/{$order->id}/dispatch-courier", [
            'courier_name' => 'بوسطة',
            'courier_party_id' => $courier->id,
            'tracking_number' => 'BST-12345678',
        ]);

        $response->assertStatus(200);
        $order->refresh();

        $this->assertEquals(WcOrderStatus::SHIPPED_VIA_COURIER, $order->status);
        $this->assertEquals('COURIER', $order->shipping_type);
        $this->assertEquals($courier->id, $order->courier_party_id);
        $this->assertEquals('BST-12345678', $order->tracking_number);
        $this->assertNotNull($order->shipped_at);

        // Deliver and collect COD from courier
        $deliverResponse = $this->actingAs($this->user)->postJson("/api/wc-orders/{$order->id}/deliver", [
            'collected_amount' => 500.00,
            'payment_method' => 'CASH',
        ]);

        $deliverResponse->assertStatus(200);
        $order->refresh();

        $this->assertEquals(WcOrderStatus::DELIVERED, $order->status);
        $this->assertNotNull($order->invoice_id);

        $invoice = Invoice::find($order->invoice_id);
        $this->assertEquals(500.00, (float) $invoice->total);
        $this->assertEquals('COURIER_COD', $invoice->payment_method->value ?? (string) $invoice->payment_method);

        // Verify NO cash deposit was made to treasury upon courier delivery
        $treasuryDeposit = \App\Models\TreasuryTransaction::where('source_type', 'INVOICE')
            ->where('source_id', $invoice->id)
            ->where('type', 'DEPOSIT')
            ->first();
        $this->assertNull($treasuryDeposit, 'Courier COD delivery must NOT deposit into physical treasury.');

        // Verify Courier ledger: Debit 500 (COD collected) - Credit 50 (shipping fee) = Net 450
        $courier->refresh();
        $this->assertEquals(450.00, (float) $courier->balance);
    }

    public function test_wc_order_delivery_with_instapay_and_vodafone_cash(): void
    {
        $product = Product::create([
            'user_id' => $this->user->id,
            'wc_product_id' => 777,
            'name' => 'سماعة بلوتوث',
            'purchase_price' => 150.00,
            'sale_price' => 300.00,
            'quantity' => 10,
        ]);

        BranchStock::create([
            'branch_id' => $this->branch->id,
            'product_id' => $product->id,
            'quantity' => 10,
        ]);

        $order = WcOrder::create([
            'user_id' => $this->user->id,
            'branch_id' => $this->branch->id,
            'wc_order_id' => 1536,
            'customer_name' => 'محمد أحمد',
            'customer_phone' => '01011223344',
            'status' => WcOrderStatus::DISPATCHED,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'shipping_cost' => 50.00,
            'subtotal' => 300.00,
            'total' => 350.00,
            'items_snapshot' => [
                [
                    'product_id' => 777,
                    'name' => 'سماعة بلوتوث',
                    'quantity' => 1,
                    'price' => 300.00,
                    'total' => 300.00,
                ],
            ],
        ]);

        $deliverResponse = $this->actingAs($this->user)->postJson("/api/wc-orders/{$order->id}/deliver", [
            'collected_amount' => 350.00,
            'payment_method' => 'INSTAPAY',
        ]);

        $deliverResponse->assertStatus(200)
            ->assertJsonPath('success', true);

        $order->refresh();
        $this->assertEquals(WcOrderStatus::DELIVERED, $order->status);

        $invoice = Invoice::find($order->invoice_id);
        $this->assertNotNull($invoice);
        $this->assertEquals('INSTAPAY', $invoice->payment_method->value ?? (string) $invoice->payment_method);
        $this->assertEquals(350.00, (float) $invoice->paid_amount);
    }

    public function test_courier_index_and_manifest_api(): void
    {
        $courier = Party::create([
            'user_id' => $this->user->id,
            'type' => PartyType::COURIER->value,
            'name' => 'شركة أرامكس للشحن السريع',
            'phone' => '01122334455',
            'balance' => 0.00,
        ]);

        $order1 = WcOrder::create([
            'user_id' => $this->user->id,
            'branch_id' => $this->branch->id,
            'courier_party_id' => $courier->id,
            'wc_order_id' => 9001,
            'customer_name' => 'سامي علي',
            'customer_phone' => '01012345678',
            'status' => WcOrderStatus::SHIPPED_VIA_COURIER,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'shipping_cost' => 45.00,
            'subtotal' => 200.00,
            'total' => 245.00,
            'tracking_number' => 'ARX-9001',
        ]);

        $order2 = WcOrder::create([
            'user_id' => $this->user->id,
            'branch_id' => $this->branch->id,
            'courier_party_id' => $courier->id,
            'wc_order_id' => 9002,
            'customer_name' => 'هدى محمود',
            'customer_phone' => '01234567890',
            'status' => WcOrderStatus::DELIVERED,
            'payment_status' => WcPaymentStatus::COLLECTED,
            'shipping_cost' => 45.00,
            'subtotal' => 500.00,
            'total' => 545.00,
            'tracking_number' => 'ARX-9002',
        ]);

        // 1. Check couriers list
        $response = $this->actingAs($this->user)->getJson('/api/couriers');
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('summary.total_couriers', 1);

        $courierData = collect($response->json('data'))->firstWhere('id', $courier->id);
        $this->assertNotNull($courierData);
        $this->assertEquals(1, $courierData['active_shipments_count']);
        $this->assertEquals(1, $courierData['delivered_shipments_count']);
        $this->assertEquals(245.00, $courierData['pending_cod_amount']);

        // 2. Check manifest
        $manifestResponse = $this->actingAs($this->user)->getJson("/api/couriers/{$courier->id}/manifest");
        $manifestResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('metrics.total_shipments', 2)
            ->assertJsonPath('metrics.in_transit_count', 1)
            ->assertJsonPath('metrics.delivered_count', 1);

        $this->assertEquals(245.00, $manifestResponse->json('metrics.pending_cod_amount'));

        $shipments = $manifestResponse->json('shipments');
        $this->assertCount(2, $shipments);
    }

    public function test_pos_invoice_creation_with_courier_and_manifest_inclusion(): void
    {
        $courier = Party::create([
            'user_id' => $this->user->id,
            'type' => PartyType::COURIER->value,
            'name' => 'شركة أسطول إكسبريس',
            'phone' => '01099887766',
            'balance' => 0.00,
        ]);

        $product = Product::create([
            'user_id' => $this->user->id,
            'name' => 'قميص أكسفورد أبيض',
            'purchase_price' => 100.00,
            'sale_price' => 250.00,
            'quantity' => 20,
        ]);

        BranchStock::create([
            'branch_id' => $this->branch->id,
            'product_id' => $product->id,
            'quantity' => 20,
        ]);

        // Create POS invoice with courier assignment and shipping amount
        $response = $this->actingAs($this->user)->postJson('/api/invoices', [
            'type' => 'SALE',
            'branch_id' => $this->branch->id,
            'date' => now()->toDateString(),
            'courier_party_id' => $courier->id,
            'shipping_amount' => 50.00,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'unit_price' => 250.00,
                ],
            ],
            'payment_method' => 'CREDIT',
            'paid_amount' => 0.00,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        $invoiceId = $response->json('data.id');
        $invoice = Invoice::find($invoiceId);
        $this->assertNotNull($invoice);
        $this->assertEquals($courier->id, $invoice->courier_party_id);
        $this->assertEquals(550.00, (float) $invoice->total); // 500 + 50 shipping
        $this->assertEquals(550.00, (float) $invoice->remaining_amount);

        // Check courier manifest includes this direct invoice
        $manifestResponse = $this->actingAs($this->user)->getJson("/api/couriers/{$courier->id}/manifest");
        $manifestResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('metrics.total_shipments', 1);

        $this->assertEquals(550.00, $manifestResponse->json('metrics.pending_cod_amount'));

        $shipments = $manifestResponse->json('shipments');
        $this->assertCount(1, $shipments);
        $this->assertEquals('DIRECT_SALE', $shipments[0]['source']);
        $this->assertEquals(550.00, (float) $shipments[0]['total']);
    }

    public function test_wc_order_courier_prepaid_online_delivery_does_not_debit_courier(): void
    {
        $courier = Party::create([
            'user_id' => $this->user->id,
            'type' => PartyType::COURIER->value,
            'name' => 'شركة أرامكس للشحن',
            'phone' => '01000000000',
            'balance' => 0.00,
        ]);

        $product = Product::create([
            'user_id' => $this->user->id,
            'name' => 'سماعات رأس لاسلكية',
            'purchase_price' => 300.00,
            'sale_price' => 600.00,
            'quantity' => 10,
        ]);

        BranchStock::create([
            'branch_id' => $this->branch->id,
            'product_id' => $product->id,
            'quantity' => 10,
        ]);

        // Create prepaid online order
        $order = WcOrder::create([
            'user_id' => $this->user->id,
            'branch_id' => $this->branch->id,
            'courier_party_id' => $courier->id,
            'wc_order_id' => 9912,
            'customer_name' => 'خالد عبد الله',
            'status' => WcOrderStatus::SHIPPED_VIA_COURIER,
            'payment_status' => WcPaymentStatus::PAID_ONLINE,
            'shipping_cost' => 50.00,
            'subtotal' => 600.00,
            'total' => 650.00,
            'items_snapshot' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 1,
                    'price' => 600.00,
                    'total' => 600.00,
                ],
            ],
        ]);

        // Deliver prepaid order: collected_amount is 0.00
        $deliverResponse = $this->actingAs($this->user)->postJson("/api/wc-orders/{$order->id}/deliver", [
            'collected_amount' => 0.00,
            'payment_method' => 'TRANSFER',
        ]);

        $deliverResponse->assertStatus(200)
            ->assertJsonPath('success', true);

        $order->refresh();
        $this->assertEquals(WcOrderStatus::DELIVERED, $order->status);

        $invoice = Invoice::find($order->invoice_id);
        $this->assertNotNull($invoice);
        $this->assertEquals('TRANSFER', $invoice->payment_method->value ?? (string) $invoice->payment_method);
        $this->assertEquals(650.00, (float) $invoice->paid_amount);

        // Courier balance has credit of 50.00 (earned shipping fee) and 0.00 COD debit -> balance is -50.00
        $courier->refresh();
        $this->assertEquals(-50.00, (float) $courier->balance);

        // No COD ledger debit on courier
        $codDebitsCount = \App\Models\LedgerEntry::where('party_id', $courier->id)->where('debit', '>', 0)->count();
        $this->assertEquals(0, $codDebitsCount);

        // Courier has exactly 1 credit entry for the earned shipping fee
        $feeCreditsCount = \App\Models\LedgerEntry::where('party_id', $courier->id)->where('credit', '>', 0)->count();
        $this->assertEquals(1, $feeCreditsCount);
    }

    public function test_courier_net_settlement_deposits_to_treasury_and_clears_balance(): void
    {
        $courier = Party::create([
            'user_id' => $this->user->id,
            'type' => PartyType::COURIER->value,
            'name' => 'شركة رابيدو للتوصيل',
            'phone' => '01011112222',
            'balance' => 450.00, // مديونية على الشركة بـ 450 ج.م بعد تسليم شحنات
        ]);

        $treasury = app(\App\Services\TreasuryService::class)->getMainTreasury($this->user->id);
        $initialBalance = (float) $treasury->balance;

        $response = $this->actingAs($this->user)->postJson("/api/couriers/{$courier->id}/settle", [
            'amount' => 450.00,
            'method' => 'CASH',
            'notes' => 'تصفية كاش باليد من مندوب رابيدو',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertEquals(450.00, (float) $response->json('data.settled_amount'));
        $this->assertEquals(0.00, (float) $response->json('data.remaining_balance'));

        $courier->refresh();
        $this->assertEquals(0.00, (float) $courier->balance);

        $treasury->refresh();
        $this->assertEquals($initialBalance + 450.00, (float) $treasury->balance);
    }
}
