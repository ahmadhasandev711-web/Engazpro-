<?php

namespace Tests\Feature;

use App\Enums\PaymentMethod;
use App\Enums\ShiftStatus;
use App\Enums\TreasuryType;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Category;
use App\Models\Invoice;
use App\Models\Party;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Shift;
use App\Models\Treasury;
use App\Models\Unit;
use App\Models\User;
use App\Services\BranchService;
use App\Services\ShiftService;
use App\Services\TreasuryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TreasuryBankAndPaymentMethodsTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $manager;
    protected User $cashier;
    protected Branch $cairoBranch;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

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

        $this->cairoBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع القاهرة',
            'code' => 'BR-01',
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->manager = User::factory()->create([
            'role' => 'MANAGER',
            'owner_id' => $this->owner->id,
            'branch_id' => $this->cairoBranch->id,
            'status' => 'ACTIVE',
        ]);

        $this->cashier = User::factory()->create([
            'role' => 'CASHIER',
            'owner_id' => $this->owner->id,
            'branch_id' => $this->cairoBranch->id,
            'status' => 'ACTIVE',
        ]);

        $cat = Category::create(['user_id' => $this->owner->id, 'name' => 'عام']);
        $unit = Unit::create(['user_id' => $this->owner->id, 'name' => 'قطعة']);
        $this->product = Product::create([
            'user_id' => $this->owner->id,
            'category_id' => $cat->id,
            'unit_id' => $unit->id,
            'name' => 'شاي العروسة 250جم',
            'code' => 'TEA-01',
            'purchase_price' => 30,
            'sale_price' => 50,
            'quantity' => 200,
        ]);

        BranchStock::create([
            'branch_id' => $this->cairoBranch->id,
            'product_id' => $this->product->id,
            'quantity' => 200,
        ]);
    }

    public function test_owner_can_create_bank_and_drawings_treasury(): void
    {
        // 1. Owner creates a bank treasury
        $bankRes = $this->actingAs($this->owner)->postJson('/api/treasuries', [
            'name' => 'حساب بنك مصر - الفرع الرئيسي',
            'type' => TreasuryType::BANK->value,
            'opening_balance' => 50000,
            'notes' => 'الحساب الجاري الرئيسي للشركة',
        ]);
        $bankRes->assertStatus(201);
        $this->assertEquals('حساب بنك مصر - الفرع الرئيسي', $bankRes->json('data.name'));
        $this->assertEquals(50000, $bankRes->json('data.balance'));

        // 2. Owner creates personal drawings treasury
        $drawRes = $this->actingAs($this->owner)->postJson('/api/treasuries', [
            'name' => 'مسحوبات شخصية - الشركاء',
            'type' => TreasuryType::OWNER_DRAWINGS->value,
            'opening_balance' => 0,
            'notes' => 'حساب جاري المسحوبات الشخصية',
        ]);
        $drawRes->assertStatus(201);
        $this->assertEquals(TreasuryType::OWNER_DRAWINGS->value, $drawRes->json('data.type'));
    }

    public function test_cashier_and_manager_rbac_treasury_restrictions(): void
    {
        // Create bank and central safe for owner
        Treasury::create([
            'user_id' => $this->owner->id,
            'name' => 'حساب CIB التجاري',
            'type' => TreasuryType::BANK,
            'balance' => 100000,
            'is_active' => true,
        ]);
        Treasury::create([
            'user_id' => $this->owner->id,
            'name' => 'خزينة مسحوبات أحمد',
            'type' => TreasuryType::OWNER_DRAWINGS,
            'balance' => 5000,
            'is_active' => true,
        ]);

        // Cashier attempts to create a treasury -> Forbidden
        $cashierCreateRes = $this->actingAs($this->cashier)->postJson('/api/treasuries', [
            'name' => 'خزنة كاشير وهمية',
            'type' => TreasuryType::BANK->value,
        ]);
        $cashierCreateRes->assertStatus(403);

        // Cashier queries treasuries -> sees ONLY assigned drawer
        $cashierList = $this->actingAs($this->cashier)->getJson('/api/treasuries');
        $cashierList->assertStatus(200);
        $cashierTreasuries = $cashierList->json('data');
        foreach ($cashierTreasuries as $t) {
            $this->assertNotEquals(TreasuryType::BANK->value, $t['type']);
            $this->assertNotEquals(TreasuryType::OWNER_DRAWINGS->value, $t['type']);
            $this->assertNotEquals(TreasuryType::MAIN->value, $t['type']);
        }

        // Manager queries treasuries -> sees Cairo branch safe/drawers, NEVER sees Banks or Drawings
        $managerList = $this->actingAs($this->manager)->getJson('/api/treasuries');
        $managerList->assertStatus(200);
        $managerTreasuries = $managerList->json('data');
        foreach ($managerTreasuries as $t) {
            $this->assertNotEquals(TreasuryType::BANK->value, $t['type']);
            $this->assertNotEquals(TreasuryType::OWNER_DRAWINGS->value, $t['type']);
        }
    }

    public function test_branch_creation_auto_generates_branch_safe(): void
    {
        $branchService = app(BranchService::class);
        $newBranch = $branchService->createBranch($this->owner, [
            'name' => 'فرع الإسكندرية',
            'code' => 'BR-ALX',
        ]);

        $this->assertNotNull($newBranch);

        $branchSafe = Treasury::withoutGlobalScopes()
            ->where('user_id', $this->owner->id)
            ->where('branch_id', $newBranch->id)
            ->where('type', TreasuryType::BRANCH_SAFE)
            ->first();

        $this->assertNotNull($branchSafe);
        $this->assertEquals("خزينة مبيعات (فرع الإسكندرية)", $branchSafe->name);
    }

    public function test_split_payment_sale_invoice_allocations(): void
    {
        // 1. Cashier opens shift
        $openRes = $this->actingAs($this->cashier)->postJson('/api/shifts/open', [
            'opening_balance' => 100,
        ]);
        $openRes->assertStatus(201);
        $shiftId = $openRes->json('data.id');

        // Drawer starts with 100
        $drawer = Treasury::withoutGlobalScopes()->where('assigned_user_id', $this->cashier->id)->first();
        $this->assertEquals(100, (float) $drawer->balance);

        // 2. Customer buys 10 units = 500 EGP total
        // Paid via SPLIT: 200 Cash + 200 InstaPay + 100 Vodafone Cash
        $saleRes = $this->actingAs($this->cashier)->postJson('/api/invoices', [
            'type' => 'SALE',
            'date' => now()->toDateString(),
            'payment_method' => 'SPLIT',
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 10, 'unit_price' => 50],
            ],
            'split_payments' => [
                ['method' => 'CASH', 'amount' => 200, 'notes' => 'كاش باليد'],
                ['method' => 'INSTAPAY', 'amount' => 200, 'notes' => 'تحويل إنستاباي من 010...'],
                ['method' => 'VODAFONE_CASH', 'amount' => 100, 'notes' => 'محفظة فودافون كاش'],
            ],
        ]);

        $saleRes->assertStatus(201);
        $invoiceId = $saleRes->json('data.id');
        $this->assertEquals(500, $saleRes->json('data.total'));
        $this->assertEquals(500, $saleRes->json('data.paid_amount'));
        $this->assertEquals(0, $saleRes->json('data.remaining_amount'));

        // Check payments table: exactly 3 payment records created for this invoice
        $payments = Payment::withoutGlobalScopes()->where('invoice_id', $invoiceId)->get();
        $this->assertCount(3, $payments);
        $this->assertEquals(1, $payments->where('method', PaymentMethod::CASH)->count());
        $this->assertEquals(1, $payments->where('method', PaymentMethod::INSTAPAY)->count());
        $this->assertEquals(1, $payments->where('method', PaymentMethod::VODAFONE_CASH)->count());

        // Cashier drawer should have received the 200 CASH part (100 opening + 200 = 300)
        $drawer->refresh();
        $this->assertEquals(300, (float) $drawer->balance);

        // Active shift should reflect:
        // cash_sales = 200, electronic_sales = 300 (200 + 100), expected_cash = 300 (100 + 200)
        $activeShiftRes = $this->actingAs($this->cashier)->getJson('/api/shifts/active');
        $activeShiftRes->assertStatus(200);
        $this->assertEquals(200, $activeShiftRes->json('data.cash_sales'));
        $this->assertEquals(300, $activeShiftRes->json('data.electronic_sales'));
        $this->assertEquals(300, $activeShiftRes->json('data.expected_cash'));
    }
}
