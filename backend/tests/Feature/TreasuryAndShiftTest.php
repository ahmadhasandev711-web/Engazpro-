<?php

namespace Tests\Feature;

use App\Enums\ShiftStatus;
use App\Enums\TreasuryTransactionType;
use App\Enums\TreasuryType;
use App\Models\Category;
use App\Models\Party;
use App\Models\Product;
use App\Models\Shift;
use App\Models\Treasury;
use App\Models\Unit;
use App\Models\User;
use App\Services\ShiftService;
use App\Services\TreasuryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TreasuryAndShiftTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $manager;
    protected User $supervisor;
    protected User $cashier;
    protected User $mandob;
    protected Product $product;
    protected Party $customer;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Create Owner with active subscription
        $this->owner = User::factory()->create([
            'role' => 'OWNER',
            'owner_id' => null,
            'status' => 'ACTIVE',
        ]);
        $this->owner->subscription()->create([
            'plan' => 'BASIC',
            'status' => 'ACTIVE',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
        ]);

        // 2. Create Manager
        $this->manager = User::factory()->create([
            'role' => 'MANAGER',
            'owner_id' => $this->owner->id,
            'status' => 'ACTIVE',
        ]);

        // 3. Create Supervisor
        $this->supervisor = User::factory()->create([
            'role' => 'SUPERVISOR',
            'owner_id' => $this->owner->id,
            'status' => 'ACTIVE',
        ]);

        // 4. Create Cashier
        $this->cashier = User::factory()->create([
            'role' => 'CASHIER',
            'owner_id' => $this->owner->id,
            'status' => 'ACTIVE',
        ]);

        // 5. Create Mandob
        $this->mandob = User::factory()->create([
            'role' => 'MANDOB',
            'owner_id' => $this->owner->id,
            'status' => 'ACTIVE',
        ]);

        // 6. Category, Unit, Product, Customer
        $category = Category::create(['user_id' => $this->owner->id, 'name' => 'عام']);
        $unit = Unit::create(['user_id' => $this->owner->id, 'name' => 'قطعة']);
        $this->product = Product::create([
            'user_id' => $this->owner->id,
            'category_id' => $category->id,
            'unit_id' => $unit->id,
            'name' => 'منتج تجريبي',
            'code' => 'PRD-01',
            'purchase_price' => 50,
            'sale_price' => 100,
            'quantity' => 100,
        ]);

        $this->customer = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'عميل تجريبي',
            'type' => 'CUSTOMER',
        ]);
    }

    public function test_zero_profit_leak_invariance(): void
    {
        // Owner CAN view profits
        $response = $this->actingAs($this->owner)->getJson('/api/dashboard');
        $response->assertStatus(200);
        $this->assertNotNull($response->json('data.kpis.today_profit'));

        // Manager CANNOT view profits
        $response = $this->actingAs($this->manager)->getJson('/api/dashboard');
        $response->assertStatus(200);
        $this->assertNull($response->json('data.kpis.today_profit'));

        // Supervisor CANNOT view profits
        $response = $this->actingAs($this->supervisor)->getJson('/api/dashboard');
        $response->assertStatus(200);
        $this->assertNull($response->json('data.kpis.today_profit'));

        // Cashier CANNOT view profits
        $response = $this->actingAs($this->cashier)->getJson('/api/dashboard');
        $response->assertStatus(200);
        $this->assertNull($response->json('data.kpis.today_profit'));

        // Mandob CANNOT view profits
        $response = $this->actingAs($this->mandob)->getJson('/api/dashboard');
        $response->assertStatus(200);
        $this->assertNull($response->json('data.kpis.today_profit'));
    }

    public function test_cashier_shift_lifecycle_and_handover(): void
    {
        // 1. Cashier opens shift with 200 EGP opening balance (drawer change)
        $openRes = $this->actingAs($this->cashier)->postJson('/api/shifts/open', [
            'opening_balance' => 200,
            'notes' => 'فكة الدرج الصباحية',
        ]);
        $openRes->assertStatus(201);
        $shiftId = $openRes->json('data.id');
        $this->assertEquals(200, $openRes->json('data.opening_balance'));
        $this->assertEquals(200, $openRes->json('data.expected_cash'));

        // Cashier drawer treasury balance should be 200
        $drawer = Treasury::withoutGlobalScopes()->where('assigned_user_id', $this->cashier->id)->first();
        $this->assertNotNull($drawer);
        $this->assertEquals(200, (float) $drawer->balance);

        // 2. Cashier sells 2 units for 200 EGP cash
        $saleRes = $this->actingAs($this->cashier)->postJson('/api/invoices', [
            'type' => 'SALE',
            'date' => now()->toDateString(),
            'payment_method' => 'CASH',
            'paid_amount' => 200,
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 2, 'unit_price' => 100],
            ],
        ]);
        $saleRes->assertStatus(201);

        // 3. Cashier creates an expense of 50 EGP (e.g. coffee/cleaning)
        $expRes = $this->actingAs($this->cashier)->postJson('/api/expenses', [
            'title' => 'نظافة وضيافة',
            'amount' => 50,
            'date' => now()->toDateString(),
        ]);
        $expRes->assertStatus(201);

        // 4. Check active shift live numbers:
        // Expected: 200 (opening) + 200 (cash sale) - 50 (expense) = 350
        $activeRes = $this->actingAs($this->cashier)->getJson('/api/shifts/active');
        $activeRes->assertStatus(200);
        $this->assertEquals(200, $activeRes->json('data.opening_balance'));
        $this->assertEquals(200, $activeRes->json('data.cash_sales'));
        $this->assertEquals(50, $activeRes->json('data.expenses'));
        $this->assertEquals(350, $activeRes->json('data.expected_cash'));

        // 5. Cashier closes shift with 350 actual cash
        $closeRes = $this->actingAs($this->cashier)->postJson('/api/shifts/close', [
            'actual_cash' => 350,
            'notes' => 'جرد نهاية الوردية سليم',
        ]);
        $closeRes->assertStatus(200);
        $this->assertEquals(ShiftStatus::CLOSED->value, $closeRes->json('data.status'));
        $this->assertEquals(0, $closeRes->json('data.difference'));

        // 6. Supervisor or Manager settles and approves handover
        $settleRes = $this->actingAs($this->supervisor)->postJson("/api/shifts/{$shiftId}/settle", [
            'settlement_notes' => 'تم استلام 350 ج.م نقداً ومطابقتها',
        ]);
        $settleRes->assertStatus(200);
        $this->assertEquals(ShiftStatus::SETTLED->value, $settleRes->json('data.shift.status'));

        // Main Treasury should now have received 350 EGP
        $mainTreasury = Treasury::withoutGlobalScopes()
            ->where('user_id', $this->owner->id)
            ->where('type', TreasuryType::MAIN)
            ->first();
        $this->assertEquals(350, (float) $mainTreasury->balance);
    }

    public function test_cashier_cash_payment_voucher_syncs_shift_expected_cash_and_dashboard_and_handover(): void
    {
        $courier = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'Sha7en',
            'type' => 'COURIER',
        ]);

        // 1. Cashier opens shift with 0 opening balance
        $openRes = $this->actingAs($this->cashier)->postJson('/api/shifts/open', [
            'opening_balance' => 0,
        ]);
        $openRes->assertStatus(201);
        $shiftId = $openRes->json('data.id');

        // 2. Cashier sells 29 units * 100 = 2900 cash
        $this->actingAs($this->cashier)->postJson('/api/invoices', [
            'type' => 'SALE',
            'date' => now()->toDateString(),
            'payment_method' => 'CASH',
            'paid_amount' => 2900,
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 29, 'unit_price' => 100],
            ],
        ])->assertStatus(201);

        // 3. Cashier issues 60 EGP cash payment voucher to courier Sha7en
        $payRes = $this->actingAs($this->cashier)->postJson('/api/payments', [
            'party_id' => $courier->id,
            'type' => 'PAYMENT',
            'amount' => 60,
            'method' => 'CASH',
            'date' => now()->toDateString(),
            'notes' => 'مصاريف توصيل شحنة',
        ]);
        $payRes->assertStatus(201);

        // Drawer actual balance is 2840
        $drawer = Treasury::withoutGlobalScopes()->where('assigned_user_id', $this->cashier->id)->firstOrFail();
        $this->assertEquals(2840.00, (float) $drawer->balance);

        // Active shift reflects 60 cash_payments and 2840 expected_cash
        $activeRes = $this->actingAs($this->cashier)->getJson('/api/shifts/active');
        $activeRes->assertStatus(200);
        $this->assertEquals(2900.00, (float) $activeRes->json('data.cash_sales'));
        $this->assertEquals(60.00, (float) $activeRes->json('data.cash_payments'));
        $this->assertEquals(2840.00, (float) $activeRes->json('data.expected_cash'));

        // Cashier dashboard cash flow reflects 60 payment_vouchers and 2840 net_cash_flow
        $dashRes = $this->actingAs($this->cashier)->getJson('/api/dashboard');
        $dashRes->assertStatus(200);
        $this->assertEquals(60.00, (float) $dashRes->json('data.cash_flow.outflow.payment_vouchers'));
        $this->assertEquals(2840.00, (float) $dashRes->json('data.cash_flow.net_cash_flow'));
        $this->assertEquals(2840.00, (float) $dashRes->json('data.kpis.today_cash_flow'));

        // Closing shift with 2840 actual cash gives zero difference and settles cleanly
        $closeRes = $this->actingAs($this->cashier)->postJson('/api/shifts/close', [
            'actual_cash' => 2840,
        ]);
        $closeRes->assertStatus(200);
        $this->assertEquals(60.00, (float) $closeRes->json('data.cash_payments'));
        $this->assertEquals(0.00, (float) $closeRes->json('data.difference'));

        $this->actingAs($this->supervisor)->postJson("/api/shifts/{$shiftId}/settle", [])->assertStatus(200);
        $drawer->refresh();
        $this->assertEquals(0.00, (float) $drawer->balance);
    }

    public function test_mandob_cash_payment_to_supplier_and_courier_security_constraints_and_delete_resync(): void
    {
        $supplier = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'مورد جملة',
            'type' => 'SUPPLIER',
        ]);
        $courier = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'شركة توصيل سريعة',
            'type' => 'COURIER',
        ]);

        // Mandob opens shift and collects 500 EGP cash receipt from customer
        $this->actingAs($this->mandob)->postJson('/api/shifts/open', ['opening_balance' => 0])->assertStatus(201);
        $this->actingAs($this->mandob)->postJson('/api/payments', [
            'party_id' => $this->customer->id,
            'type' => 'RECEIPT',
            'amount' => 500,
            'method' => 'CASH',
            'date' => now()->toDateString(),
        ])->assertStatus(201);

        // Mandob cannot pay via electronic transfer/instapay (central company account protection)
        $this->actingAs($this->mandob)->postJson('/api/payments', [
            'party_id' => $supplier->id,
            'type' => 'PAYMENT',
            'amount' => 100,
            'method' => 'INSTAPAY',
            'date' => now()->toDateString(),
        ])->assertStatus(422);

        // Mandob cannot pay a CUSTOMER directly via payment voucher
        $this->actingAs($this->mandob)->postJson('/api/payments', [
            'party_id' => $this->customer->id,
            'type' => 'PAYMENT',
            'amount' => 100,
            'method' => 'CASH',
            'date' => now()->toDateString(),
        ])->assertStatus(422);

        // Mandob pays 200 to supplier and 50 to courier in cash
        $supplierPayRes = $this->actingAs($this->mandob)->postJson('/api/payments', [
            'party_id' => $supplier->id,
            'type' => 'PAYMENT',
            'amount' => 200,
            'method' => 'CASH',
            'date' => now()->toDateString(),
        ]);
        $supplierPayRes->assertStatus(201);
        $supplierPaymentId = $supplierPayRes->json('data.id');

        $this->actingAs($this->mandob)->postJson('/api/payments', [
            'party_id' => $courier->id,
            'type' => 'PAYMENT',
            'amount' => 50,
            'method' => 'CASH',
            'date' => now()->toDateString(),
        ])->assertStatus(201);

        // Cannot spend more than current custody balance (remaining = 250)
        $this->actingAs($this->mandob)->postJson('/api/payments', [
            'party_id' => $supplier->id,
            'type' => 'PAYMENT',
            'amount' => 300,
            'method' => 'CASH',
            'date' => now()->toDateString(),
        ])->assertStatus(422);

        // Active shift reflects 250 cash_payments and 250 expected_cash
        $activeRes = $this->actingAs($this->mandob)->getJson('/api/shifts/active');
        $activeRes->assertStatus(200);
        $this->assertEquals(500.00, (float) $activeRes->json('data.cash_receipts'));
        $this->assertEquals(250.00, (float) $activeRes->json('data.cash_payments'));
        $this->assertEquals(250.00, (float) $activeRes->json('data.expected_cash'));

        // Owner deletes the 200 supplier payment -> Mandob's shift resyncs automatically to 50 cash_payments / 450 expected_cash
        $this->actingAs($this->owner)->deleteJson("/api/payments/{$supplierPaymentId}")->assertStatus(200);

        $activeAfterDelete = $this->actingAs($this->mandob)->getJson('/api/shifts/active');
        $activeAfterDelete->assertStatus(200);
        $this->assertEquals(50.00, (float) $activeAfterDelete->json('data.cash_payments'));
        $this->assertEquals(450.00, (float) $activeAfterDelete->json('data.expected_cash'));
    }

    public function test_parties_endpoint_supports_multiple_comma_separated_types(): void
    {
        Party::create(['user_id' => $this->owner->id, 'name' => 'مورد ألف', 'type' => 'SUPPLIER']);
        Party::create(['user_id' => $this->owner->id, 'name' => 'شركة شحن باء', 'type' => 'COURIER']);

        $res = $this->actingAs($this->mandob)->getJson('/api/parties?type=SUPPLIER,COURIER');
        $res->assertStatus(200);

        $types = collect($res->json('data'))->pluck('type')->all();
        $this->assertContains('SUPPLIER', $types);
        $this->assertContains('COURIER', $types);
        $this->assertNotContains('CUSTOMER', $types);
    }

}
