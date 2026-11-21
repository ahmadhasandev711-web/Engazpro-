<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\CommissionType;
use App\Enums\EcommercePlatform;
use App\Enums\ExchangeStatus;
use App\Enums\InvoiceType;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\ReturnItemCondition;
use App\Enums\ShiftStatus;
use App\Enums\StoreCreditTransactionType;
use App\Enums\SubscriptionStatus;
use App\Enums\TreasuryType;
use App\Enums\UserRole;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Exchange;
use App\Models\OnlineOrder;
use App\Models\OnlineOrderItem;
use App\Models\Party;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Models\Shift;
use App\Models\StoreCreditTransaction;
use App\Models\Subscription;
use App\Models\Treasury;
use App\Models\User;
use App\Services\Exchange\StoreCreditService;
use App\Services\PayrollService;
use App\Services\ReportService;
use App\Services\SettingService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SmartExchangeAndAntiFraudTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $cashier;
    private User $salesRep;
    private Branch $mainBranch;
    private Branch $secondBranch;
    private Treasury $drawer;
    private Shift $shift;
    private Party $customer;
    private Product $dress;
    private ProductVariant $sizeM;
    private ProductVariant $sizeL;
    private ProductVariant $sizeXL;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'role' => UserRole::OWNER->value,
            'ecommerce_enabled' => true,
        ]);
        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => SubscriptionStatus::ACTIVE->value,
            'plan' => 'PRO_ECOMMERCE',
        ]);
        $this->mainBranch = Branch::create([
            'user_id' => $this->owner->id, 'name' => 'الفرع الرئيسي', 'code' => 'BR-01',
            'type' => BranchType::STORE->value, 'is_main' => true, 'is_active' => true,
        ]);
        $this->secondBranch = Branch::create([
            'user_id' => $this->owner->id, 'name' => 'فرع المعادي', 'code' => 'BR-02',
            'type' => BranchType::STORE->value, 'is_main' => false, 'is_active' => true,
        ]);

        Treasury::create([
            'user_id' => $this->owner->id, 'branch_id' => $this->mainBranch->id,
            'name' => 'الخزنة الرئيسية', 'type' => TreasuryType::MAIN->value, 'balance' => 0, 'is_active' => true,
        ]);

        $this->salesRep = User::factory()->create([
            'owner_id' => $this->owner->id, 'branch_id' => $this->mainBranch->id,
            'role' => UserRole::SALES->value,
            'commission_type' => CommissionType::PERCENTAGE_OF_SALES->value,
            'commission_rate' => 10,
        ]);

        $this->cashier = User::factory()->create([
            'owner_id' => $this->owner->id, 'branch_id' => $this->mainBranch->id,
            'role' => UserRole::CASHIER->value,
            'commission_type' => CommissionType::FIXED_PER_INVOICE->value,
            'commission_rate' => 25,
        ]);

        $this->drawer = Treasury::create([
            'user_id' => $this->owner->id, 'branch_id' => $this->mainBranch->id,
            'assigned_user_id' => $this->cashier->id, 'name' => 'درج الكاشير',
            'type' => TreasuryType::CASHIER_DRAWER->value, 'balance' => 1000, 'is_active' => true,
        ]);

        $this->shift = Shift::create([
            'user_id' => $this->owner->id, 'branch_id' => $this->mainBranch->id,
            'created_by' => $this->cashier->id, 'treasury_id' => $this->drawer->id,
            'shift_number' => 'SH-001', 'status' => ShiftStatus::OPEN->value,
            'opened_at' => now(), 'opening_balance' => 1000,
        ]);

        $this->customer = Party::create([
            'user_id' => $this->owner->id, 'type' => PartyType::CUSTOMER->value,
            'name' => 'سارة محمود', 'phone' => '01012340017', 'balance' => 0,
        ]);

        $this->dress = Product::create([
            'user_id' => $this->owner->id, 'name' => 'فستان سهرة', 'code' => 'DRESS-01',
            'type' => 'VARIABLE', 'has_variants' => true,
            'purchase_price' => 400, 'selling_price' => 800, 'quantity' => 30,
        ]);
        $this->sizeM = ProductVariant::create([
            'user_id' => $this->owner->id, 'product_id' => $this->dress->id,
            'name' => 'أسود - M', 'size' => 'M', 'color' => 'أسود',
            'code' => 'DRESS-01-M', 'purchase_price' => 400, 'selling_price' => 800, 'quantity' => 10,
        ]);
        $this->sizeL = ProductVariant::create([
            'user_id' => $this->owner->id, 'product_id' => $this->dress->id,
            'name' => 'أسود - L', 'size' => 'L', 'color' => 'أسود',
            'code' => 'DRESS-01-L', 'purchase_price' => 450, 'selling_price' => 1050, 'quantity' => 10,
        ]);
        $this->sizeXL = ProductVariant::create([
            'user_id' => $this->owner->id, 'product_id' => $this->dress->id,
            'name' => 'نبيتي - XL', 'size' => 'XL', 'color' => 'نبيتي',
            'code' => 'DRESS-01-XL', 'purchase_price' => 300, 'selling_price' => 600, 'quantity' => 10,
        ]);

        foreach ([$this->sizeM, $this->sizeL, $this->sizeXL] as $var) {
            BranchStock::create([
                'branch_id' => $this->mainBranch->id, 'product_id' => $this->dress->id,
                'product_variant_id' => $var->id, 'quantity' => 10,
            ]);
            BranchStock::create([
                'branch_id' => $this->secondBranch->id, 'product_id' => $this->dress->id,
                'product_variant_id' => $var->id, 'quantity' => 5,
            ]);
        }
    }

    private function seedSaleBySalesRep(?User $creator = null, ?Branch $branch = null, ?Party $party = null): array
    {
        Sanctum::actingAs($creator ?? $this->owner);

        return $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE->value,
            'branch_id' => ($branch ?? $this->mainBranch)->id,
            'party_id' => ($party ?? $this->customer)->id,
            'salesperson_id' => $this->salesRep->id,
            'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::CASH->value,
            'paid_amount' => 800,
            'items' => [[
                'product_id' => $this->dress->id,
                'product_variant_id' => $this->sizeM->id,
                'quantity' => 1,
                'unit_price' => 800,
            ]],
        ])->assertStatus(201)->json('data');
    }

    public function test_smart_lookup_separates_short_invoice_number_from_mobile_phone_and_respects_branch(): void
    {
        $sale = $this->seedSaleBySalesRep($this->owner, $this->mainBranch, $this->customer);
        $secondCustomer = Party::create([
            'user_id' => $this->owner->id, 'type' => PartyType::CUSTOMER->value,
            'name' => 'عميلة المعادي', 'phone' => '01199887766', 'balance' => 0,
        ]);
        $otherBranchSale = $this->seedSaleBySalesRep($this->owner, $this->secondBranch, $secondCustomer);

        Sanctum::actingAs($this->cashier);

        // Privacy of /api/invoices still preserved (only cashier's own created invoices)
        $listIds = collect($this->getJson('/api/invoices')->assertOk()->json('data'))->pluck('id')->all();
        $this->assertNotContains($sale['id'], $listIds);

        // Searching "1" must match INV-00001 cleanly and NOT confuse with phone ending in "0017"
        $byShort = $this->getJson('/api/exchanges/lookup-invoices?q=1')->assertOk()->json('data');
        $this->assertCount(1, $byShort);
        $this->assertEquals($sale['id'], $byShort[0]['id']);

        // Searching mobile phone finds customer invoice across branch even if created by owner
        $byPhone = $this->getJson('/api/exchanges/lookup-invoices?q=01012340017')->assertOk()->json('data');
        $this->assertCount(1, $byPhone);
        $this->assertEquals($sale['id'], $byPhone[0]['id']);

        // Searching another branch's phone returns zero results for branch-locked cashier
        $crossBranch = $this->getJson('/api/exchanges/lookup-invoices?q=01199887766')->assertOk()->json('data');
        $this->assertCount(0, $crossBranch);
        $this->assertNotNull($otherBranchSale['id']);
    }

    public function test_cashier_cannot_steal_salesperson_commission_during_exchange_and_payroll_remains_cheat_proof(): void
    {
        $sale = $this->seedSaleBySalesRep($this->owner, $this->mainBranch, $this->customer);
        Sanctum::actingAs($this->cashier);

        // Cashier tries to attribute replacement invoice to himself => 403
        $this->postJson('/api/exchanges', [
            'original_invoice_id' => $sale['id'],
            'replacement_salesperson_id' => $this->cashier->id,
            'returned_items' => [[
                'product_id' => $this->dress->id, 'product_variant_id' => $this->sizeM->id, 'quantity' => 1,
            ]],
            'replacement_items' => [[
                'product_id' => $this->dress->id, 'product_variant_id' => $this->sizeL->id, 'quantity' => 1, 'unit_price' => 1050,
            ]],
            'payment_method' => PaymentMethod::CASH->value,
        ])->assertStatus(403);

        // Legitimate exchange by cashier locks BOTH return & replacement to original salesRep (+250 upgrade net)
        $res = $this->postJson('/api/exchanges', [
            'original_invoice_id' => $sale['id'],
            'returned_items' => [[
                'product_id' => $this->dress->id, 'product_variant_id' => $this->sizeM->id, 'quantity' => 1,
            ]],
            'replacement_items' => [[
                'product_id' => $this->dress->id, 'product_variant_id' => $this->sizeL->id, 'quantity' => 1, 'unit_price' => 1050,
            ]],
            'payment_method' => PaymentMethod::CASH->value,
        ])->assertStatus(201)->json('data');

        $this->assertEquals($this->salesRep->id, $res['salesperson_id']);
        $this->assertEquals(250.0, $res['net_amount']);
        $this->assertEquals(1250.0, (float) $this->drawer->fresh()->balance);
        $this->assertEquals(1250.0, (float) $this->shift->fresh()->expected_cash);

        // Verify payroll: salesRep gets 10% on net 1050 (800 - 800 + 1050 = 1050 => 105), cashier gets 0 fixed invoice bonus
        $payroll = app(PayrollService::class);
        $repSummary = $payroll->calculateMonthlyPayroll($this->salesRep, now()->format('Y-m'));
        $cashierSummary = $payroll->calculateMonthlyPayroll($this->cashier, now()->format('Y-m'));

        $this->assertEquals(1050.0, $repSummary['total_sales']);
        $this->assertEquals(105.0, $repSummary['commission_amount']);
        $this->assertEquals(0, $cashierSummary['invoices_count']);
        $this->assertEquals(0.0, $cashierSummary['commission_amount']);
    }

    public function test_unlinked_exchange_permission_setting_and_damaged_stock_isolation_and_store_credit(): void
    {
        Sanctum::actingAs($this->cashier);

        // Cashier blocked from unlinked exchange by default
        $this->postJson('/api/exchanges', [
            'party_id' => $this->customer->id,
            'returned_items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeM->id, 'quantity' => 1, 'unit_price' => 800]],
            'replacement_items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeXL->id, 'quantity' => 1, 'unit_price' => 600]],
        ])->assertStatus(403);

        // Enable unlinked exchange for cashier
        Setting::create(['user_id' => $this->owner->id, 'key' => SettingService::KEY_ALLOW_CASHIER_UNLINKED_EXCHANGE, 'value' => '1']);

        // Cashier executes unlinked exchange with DAMAGED item => leftover 200 goes to STORE_CREDIT, drawer untouched, sizeM NOT incremented!
        $res = $this->postJson('/api/exchanges', [
            'party_id' => $this->customer->id,
            'returned_items' => [[
                'product_id' => $this->dress->id, 'product_variant_id' => $this->sizeM->id,
                'quantity' => 1, 'unit_price' => 800, 'condition' => ReturnItemCondition::DAMAGED->value,
            ]],
            'replacement_items' => [[
                'product_id' => $this->dress->id, 'product_variant_id' => $this->sizeXL->id,
                'quantity' => 1, 'unit_price' => 600,
            ]],
            'surplus_settlement' => 'STORE_CREDIT',
        ])->assertStatus(201)->json('data');

        $this->assertNull($res['salesperson_id']);
        $this->assertEquals(-200.0, $res['net_amount']);
        $this->assertEquals(1000.0, (float) $this->drawer->fresh()->balance);
        $this->assertEquals(200.0, (float) $this->customer->fresh()->store_credit_balance);
        $this->assertEquals(10.0, (float) $this->sizeM->fresh()->quantity); // DAMAGED did not increment sellable stock
        $this->assertEquals(9.0, (float) $this->sizeXL->fresh()->quantity); // Replacement deducted

        // Customer redeems 200 STORE_CREDIT in next invoice
        $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE->value,
            'branch_id' => $this->mainBranch->id,
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::STORE_CREDIT->value,
            'paid_amount' => 200,
            'items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeXL->id, 'quantity' => 1, 'unit_price' => 200]],
        ])->assertStatus(201);

        $this->assertEquals(0.0, (float) $this->customer->fresh()->store_credit_balance);
        $this->assertEquals(1000.0, (float) $this->drawer->fresh()->balance); // Store credit did NOT inflate cash drawer

        // Direct spoofing of EXCHANGE_OFFSET via /api/invoices must be rejected cleanly
        $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE->value,
            'branch_id' => $this->mainBranch->id,
            'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::EXCHANGE_OFFSET->value,
            'paid_amount' => 600,
            'items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeXL->id, 'quantity' => 1, 'unit_price' => 600]],
        ])->assertStatus(422);
    }

    public function test_online_order_pre_delivery_swap_and_post_delivery_courier_exchange_lifecycle(): void
    {
        $courier = Party::create([
            'user_id' => $this->owner->id, 'type' => PartyType::COURIER->value,
            'name' => 'بوسطة للشحن', 'phone' => '01200001111', 'balance' => 0,
        ]);
        $sale = $this->seedSaleBySalesRep($this->owner, $this->mainBranch, $this->customer);

        // 1. Pre-delivery variant swap
        $pendingOrder = OnlineOrder::create([
            'user_id' => $this->owner->id, 'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => '9910', 'external_order_number' => '#9910',
            'party_id' => $this->customer->id, 'branch_id' => $this->mainBranch->id,
            'status' => WcOrderStatus::CONFIRMED, 'payment_status' => WcPaymentStatus::PENDING_COD,
            'subtotal' => 800, 'total' => 800, 'customer_name' => 'سارة', 'customer_phone' => '01012340017',
        ]);
        OnlineOrderItem::create([
            'user_id' => $this->owner->id, 'online_order_id' => $pendingOrder->id,
            'product_id' => $this->dress->id, 'product_variant_id' => $this->sizeM->id, 'quantity' => 1,
        ]);

        Sanctum::actingAs($this->owner);
        $swapped = $this->postJson("/api/online-orders/{$pendingOrder->id}/swap-items", [
            'items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeL->id, 'quantity' => 1, 'unit_price' => 1050]],
            'notes' => 'العميلة غيرت المقاس لـ L قبل الشحن',
        ])->assertOk()->json('data');
        $this->assertEquals(1050.0, $swapped['total']);

        // 2. Post-delivery exchange from DELIVERED online order
        $deliveredOrder = OnlineOrder::create([
            'user_id' => $this->owner->id, 'platform' => EcommercePlatform::SHOPIFY,
            'external_order_id' => '7720', 'external_order_number' => '#7720',
            'party_id' => $this->customer->id, 'branch_id' => $this->mainBranch->id,
            'invoice_id' => $sale['id'], 'status' => WcOrderStatus::DELIVERED,
            'payment_status' => WcPaymentStatus::COLLECTED, 'subtotal' => 800, 'total' => 800,
            'customer_name' => 'سارة', 'customer_phone' => '01012340017', 'customer_address' => 'المعادي',
        ]);

        $exchangeRes = $this->postJson("/api/online-orders/{$deliveredOrder->id}/exchange", [
            'returned_items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeM->id, 'quantity' => 1]],
            'replacement_items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeL->id, 'quantity' => 1, 'unit_price' => 1050]],
            'exchange_shipping_fee' => 50,
            'notes' => 'تبديل مقاس + دفع فرق 250 + شحن 50',
        ])->assertStatus(201)->json('data');

        // Replacement online order COD must equal (1050 + 50) - 800 = 300 ONLY, and sizeM stock NOT incremented yet!
        $repOrderId = $exchangeRes['replacement_online_order_id'];
        $repOrder = OnlineOrder::findOrFail($repOrderId);
        $this->assertTrue($repOrder->is_exchange);
        $this->assertEquals(300.0, (float) $repOrder->total);
        $this->assertEquals(9.0, (float) $this->sizeM->fresh()->quantity); // Still 9 from original sale!

        // Dispatch to courier & deliver
        $this->postJson("/api/online-orders/{$repOrderId}/dispatch-courier", [
            'courier_party_id' => $courier->id, 'tracking_number' => 'BOSTA-EX-1',
        ])->assertOk();

        $this->postJson("/api/online-orders/{$repOrderId}/deliver", [
            'collected_amount' => 300, 'payment_method' => PaymentMethod::COURIER_COD->value,
        ])->assertOk();

        // After delivery: sizeM returned (+1 -> 10), sizeL deducted (-1 -> 9), courier collected 300 minus 50 shipping fee => 250 net balance, exchange COMPLETED
        $this->assertEquals(10.0, (float) $this->sizeM->fresh()->quantity);
        $this->assertEquals(9.0, (float) $this->sizeL->fresh()->quantity);
        $this->assertEquals(250.0, (float) $courier->fresh()->balance);
        $this->getJson("/api/exchanges/{$exchangeRes['id']}")
            ->assertOk()
            ->assertJsonPath('data.status', ExchangeStatus::COMPLETED->value);
    }

    public function test_online_partial_exchange_instapay_refund_and_report_cash_flow_parity(): void
    {
        $courier = Party::create([
            'user_id' => $this->owner->id, 'type' => PartyType::COURIER->value,
            'name' => 'أرامكس', 'phone' => '01200002222', 'balance' => 0,
        ]);
        $instapayWallet = Treasury::create([
            'user_id' => $this->owner->id, 'name' => 'حساب إنستاباي (InstaPay)',
            'type' => TreasuryType::WALLET->value, 'balance' => 1000, 'is_active' => true,
        ]);

        // Multi-item invoice: Dress M (800) + Blouse XL (600)
        Sanctum::actingAs($this->owner);
        $sale = $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE->value, 'branch_id' => $this->mainBranch->id,
            'party_id' => $this->customer->id, 'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::INSTAPAY->value, 'paid_amount' => 1400,
            'items' => [
                ['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeM->id, 'quantity' => 1, 'unit_price' => 800],
                ['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeXL->id, 'quantity' => 1, 'unit_price' => 600],
            ],
        ])->assertStatus(201)->json('data');

        // Guest order without party_id must reject STORE_CREDIT surplus before shipping
        $guestOrder = OnlineOrder::create([
            'user_id' => $this->owner->id, 'platform' => EcommercePlatform::SHOPIFY,
            'external_order_id' => '9900', 'external_order_number' => '#9900',
            'party_id' => null, 'branch_id' => $this->mainBranch->id,
            'invoice_id' => $sale['id'], 'status' => WcOrderStatus::DELIVERED,
            'payment_status' => WcPaymentStatus::PAID_ONLINE, 'subtotal' => 1400, 'total' => 1400,
        ]);
        $this->postJson("/api/online-orders/{$guestOrder->id}/exchange", [
            'returned_items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeM->id, 'quantity' => 1]],
            'replacement_items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeXL->id, 'quantity' => 1, 'unit_price' => 500]],
            'exchange_shipping_fee' => 50,
            'surplus_settlement' => 'STORE_CREDIT',
        ])->assertStatus(422)->assertJsonPath('error_code', 'CUSTOMER_REQUIRED_FOR_STORE_CREDIT');

        // Registered customer order exchanges ONLY 1 item (800 -> 500 + 50 shipping => 250 surplus refunded via INSTAPAY on delivery)
        $deliveredOrder = OnlineOrder::create([
            'user_id' => $this->owner->id, 'platform' => EcommercePlatform::SHOPIFY,
            'external_order_id' => '9901', 'external_order_number' => '#9901',
            'party_id' => $this->customer->id, 'branch_id' => $this->mainBranch->id,
            'invoice_id' => $sale['id'], 'status' => WcOrderStatus::DELIVERED,
            'payment_status' => WcPaymentStatus::PAID_ONLINE, 'subtotal' => 1400, 'total' => 1400,
        ]);
        $ex = $this->postJson("/api/online-orders/{$deliveredOrder->id}/exchange", [
            'returned_items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeM->id, 'quantity' => 1]],
            'replacement_items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeXL->id, 'quantity' => 1, 'unit_price' => 500]],
            'exchange_shipping_fee' => 50,
            'surplus_settlement' => 'REFUND_CASH',
            'refund_method' => PaymentMethod::INSTAPAY->value,
        ])->assertStatus(201)->json('data');

        // Wallet NOT deducted BEFORE actual courier delivery/pickup (still 1000 + 1400 = 2400)
        $this->assertEquals(2400.0, (float) $instapayWallet->fresh()->balance);

        $repOrderId = $ex['replacement_online_order_id'];
        $this->postJson("/api/online-orders/{$repOrderId}/dispatch-courier", ['courier_party_id' => $courier->id])->assertOk();
        $this->postJson("/api/online-orders/{$repOrderId}/deliver", ['collected_amount' => 0])->assertOk();

        // After delivery: InstaPay treasury reduced by exact 250 refund (2400 - 250 = 2150), XL deducted 1 more, M returned +1
        $this->assertEquals(2150.0, (float) $instapayWallet->fresh()->balance);
        $this->assertEquals(10.0, (float) $this->sizeM->fresh()->quantity);
        $this->assertEquals(8.0, (float) $this->sizeXL->fresh()->quantity);

        // ReportService cashFlow endpoint for INSTAPAY MUST include SPLIT SALE_RETURN 250 outflow!
        $cashFlow = $this->getJson('/api/reports/cash-flow?from_date=' . now()->toDateString() . '&to_date=' . now()->toDateString())
            ->assertOk()
            ->json('data');
        $this->assertEquals(250.0, (float) $cashFlow['treasuries']['instapay']['outflow']['sale_returns']);
        $this->assertEquals(1150.0, (float) $cashFlow['treasuries']['instapay']['net_balance']);
    }

    public function test_store_credit_fifo_expiry_split_redemption_and_invoice_exchange_cancellation(): void
    {
        $creditService = app(StoreCreditService::class);
        $ex1 = Exchange::create([
            'user_id' => $this->owner->id, 'branch_id' => $this->mainBranch->id, 'created_by' => $this->owner->id,
            'exchange_number' => 'EXC-90001', 'source' => 'POS', 'status' => 'COMPLETED',
            'party_id' => $this->customer->id, 'return_total' => 100, 'replacement_total' => 0,
            'net_amount' => -100, 'settlement_type' => 'STORE_CREDIT',
        ]);
        $ex2 = Exchange::create([
            'user_id' => $this->owner->id, 'branch_id' => $this->mainBranch->id, 'created_by' => $this->owner->id,
            'exchange_number' => 'EXC-90002', 'source' => 'POS', 'status' => 'COMPLETED',
            'party_id' => $this->customer->id, 'return_total' => 200, 'replacement_total' => 0,
            'net_amount' => -200, 'settlement_type' => 'STORE_CREDIT',
        ]);

        // Bucket 1: 100 expiring tomorrow; Bucket 2: 200 never expires
        $tx1 = $creditService->earnFromExchange($this->owner, $this->customer, Money::of(100), $ex1, now()->addDay());
        $creditService->earnFromExchange($this->owner, $this->customer, Money::of(200), $ex2, null);

        // Customer buys 400 item using SPLIT (150 STORE_CREDIT + 250 CASH) -> FIFO consumes all 100 of Bucket 1 + 50 of Bucket 2
        Sanctum::actingAs($this->owner);
        $splitSale = $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE->value, 'branch_id' => $this->mainBranch->id, 'party_id' => $this->customer->id,
            'date' => now()->toDateString(), 'payment_method' => PaymentMethod::SPLIT->value, 'paid_amount' => 400,
            'split_payments' => [
                ['method' => PaymentMethod::STORE_CREDIT->value, 'amount' => 150],
                ['method' => PaymentMethod::CASH->value, 'amount' => 250],
            ],
            'items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeL->id, 'quantity' => 1, 'unit_price' => 400]],
        ])->assertStatus(201)->json('data');

        $this->assertEquals(150.0, (float) $this->customer->fresh()->store_credit_balance);

        // Simulate Bucket 1 reaching expiry date: because Bucket 1 was ALREADY consumed FIFO, valid remaining balance MUST stay 150!
        StoreCreditTransaction::whereKey($tx1->id)->update(['expires_at' => now()->subMinute()]);
        $this->assertEquals(150.0, $creditService->getValidBalance($this->owner, $this->customer->fresh())->getAmount());

        // Delete split sale invoice -> restores 150 STORE_CREDIT back to 300!
        $this->deleteJson("/api/invoices/{$splitSale['id']}")->assertOk();
        $this->assertEquals(300.0, (float) $this->customer->fresh()->store_credit_balance);

        // Complete a real POS exchange (DAMAGED item + +250 CASH), block single-invoice deletion (422), then test full atomic cancel
        Sanctum::actingAs($this->cashier);
        $posEx = $this->postJson('/api/exchanges', [
            'branch_id' => $this->mainBranch->id,
            'party_id' => $this->customer->id,
            'returned_items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeM->id, 'quantity' => 1, 'unit_price' => 800, 'condition' => ReturnItemCondition::DAMAGED->value]],
            'replacement_items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeL->id, 'quantity' => 1, 'unit_price' => 1050]],
            'payment_method' => PaymentMethod::CASH->value,
        ]);
        // Enable unlinked for cashier or run as owner: enable unlinked first for this branch cashier
        Setting::updateOrCreate(['user_id' => $this->owner->id, 'key' => SettingService::KEY_ALLOW_CASHIER_UNLINKED_EXCHANGE], ['value' => '1']);
        $posEx = $this->postJson('/api/exchanges', [
            'branch_id' => $this->mainBranch->id,
            'party_id' => $this->customer->id,
            'returned_items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeM->id, 'quantity' => 1, 'unit_price' => 800, 'condition' => ReturnItemCondition::DAMAGED->value]],
            'replacement_items' => [['product_id' => $this->dress->id, 'product_variant_id' => $this->sizeL->id, 'quantity' => 1, 'unit_price' => 1050]],
            'payment_method' => PaymentMethod::CASH->value,
        ])->assertStatus(201)->json('data');

        $this->assertEquals(1250.0, (float) $this->drawer->fresh()->balance);
        $this->assertEquals(9.0, (float) $this->sizeL->fresh()->quantity);
        $this->assertEquals(10.0, (float) $this->sizeM->fresh()->quantity);

        // Cashier cannot cancel exchange (403); Owner blocked from deleting half invoice (422); Owner cancels whole exchange cleanly
        $this->postJson("/api/exchanges/{$posEx['id']}/cancel")->assertStatus(403);
        Sanctum::actingAs($this->owner);
        $this->deleteJson("/api/invoices/{$posEx['replacement_invoice_id']}")->assertStatus(422)->assertJsonPath('error_code', 'EXCHANGE_INVOICE_PROTECTED');

        $this->postJson("/api/exchanges/{$posEx['id']}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', ExchangeStatus::CANCELLED->value);

        // Reversal restored sizeL (+1 => 10), did NOT touch DAMAGED sizeM (still 10), and reversed drawer back to 1000!
        $this->assertEquals(10.0, (float) $this->sizeL->fresh()->quantity);
        $this->assertEquals(10.0, (float) $this->sizeM->fresh()->quantity);
        $this->assertEquals(1000.0, (float) $this->drawer->fresh()->balance);
    }
}
