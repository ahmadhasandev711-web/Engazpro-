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

}
