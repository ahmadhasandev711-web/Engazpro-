<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\CommissionType;
use App\Enums\InvoiceType;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\ProductType;
use App\Enums\ShiftStatus;
use App\Enums\SubscriptionStatus;
use App\Enums\TreasuryType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Party;
use App\Models\Product;
use App\Models\Shift;
use App\Models\Subscription;
use App\Models\Treasury;
use App\Models\User;
use App\Services\PayrollService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SecurityAndAccountingHardeningWaveTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Branch $branchMain;
    private Product $product;
    private Party $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'role' => UserRole::OWNER->value,
            'phone' => '01077000001',
            'status' => UserStatus::ACTIVE->value,
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => SubscriptionStatus::ACTIVE->value,
            'plan' => 'PRO',
        ]);

        $this->branchMain = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع الدقي',
            'code' => 'BR-DK',
            'type' => BranchType::STORE->value,
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'ساعة ذكية',
            'code' => 'WATCH-1',
            'type' => ProductType::STANDARD->value,
            'purchase_price' => 400,
            'regular_price' => 900,
            'sale_price' => 900,
            'quantity' => 50,
            'unit' => 'قطعة',
        ]);

        BranchStock::create(['branch_id' => $this->branchMain->id, 'product_id' => $this->product->id, 'quantity' => 30]);

        $this->customer = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'كريم عادل',
            'type' => PartyType::CUSTOMER->value,
            'balance' => 0,
        ]);
    }

    private function createStaff(UserRole $role, string $phone, array $extra = []): User
    {
        return User::factory()->create([
            'owner_id' => $this->owner->id,
            'branch_id' => $this->branchMain->id,
            'role' => $role->value,
            'phone' => $phone,
            'status' => UserStatus::ACTIVE->value,
            ...$extra,
        ]);
    }

    public function test_cashier_can_edit_and_delete_open_shift_expense_with_atomic_treasury_and_shift_sync(): void
    {
        $cashier = $this->createStaff(UserRole::CASHIER, '01077000010');
        $drawer = Treasury::create([
            'user_id' => $this->owner->id,
            'branch_id' => $this->branchMain->id,
            'assigned_user_id' => $cashier->id,
            'name' => 'درج كاشير الدقي',
            'type' => TreasuryType::CASHIER_DRAWER->value,
            'balance' => 1000,
            'is_active' => true,
        ]);

        $shift = Shift::create([
            'user_id' => $this->owner->id,
            'created_by' => $cashier->id,
            'treasury_id' => $drawer->id,
            'shift_number' => 'SH-EXP-1',
            'status' => ShiftStatus::OPEN->value,
            'opened_at' => now(),
            'opening_balance' => 1000,
        ]);

        Sanctum::actingAs($cashier);

        // Typo: 500 instead of 50 -> drawer drops to 500, expected_cash = 500
        $createRes = $this->postJson('/api/expenses', [
            'title' => 'نثريات نظافة',
            'category' => 'أخرى',
            'amount' => 500,
            'payment_method' => PaymentMethod::CASH->value,
            'date' => now()->toDateString(),
        ])->assertStatus(201);

        $expenseId = $createRes->json('data.id');
        $this->assertEquals(500.0, (float) $drawer->fresh()->balance);
        $this->assertEquals(500.0, (float) $shift->fresh()->expenses);
        $this->assertEquals(500.0, (float) $shift->fresh()->expected_cash);

        // Cashier fixes typo 500 -> 50 -> drawer recovers +450 to 950, expected_cash recovers to 950
        $this->putJson("/api/expenses/{$expenseId}", [
            'title' => 'نثريات نظافة',
            'category' => 'أخرى',
            'amount' => 50,
            'payment_method' => PaymentMethod::CASH->value,
            'date' => now()->toDateString(),
        ])->assertOk();

        $this->assertEquals(950.0, (float) $drawer->fresh()->balance);
        $this->assertEquals(50.0, (float) $shift->fresh()->expenses);
        $this->assertEquals(950.0, (float) $shift->fresh()->expected_cash);

        // Cashier cancels/deletes wrong expense -> drawer returns to 1000, shift expenses to 0
        $this->deleteJson("/api/expenses/{$expenseId}")->assertOk();
        $this->assertEquals(1000.0, (float) $drawer->fresh()->balance);
        $this->assertEquals(0.0, (float) $shift->fresh()->expenses);
        $this->assertEquals(1000.0, (float) $shift->fresh()->expected_cash);
    }

    public function test_closed_shift_expense_cannot_be_edited_or_deleted_by_non_owner_but_owner_can(): void
    {
        $cashier = $this->createStaff(UserRole::CASHIER, '01077000011');
        $supervisor = $this->createStaff(UserRole::SUPERVISOR, '01077000012');
        $manager = $this->createStaff(UserRole::MANAGER, '01077000013');

        $drawer = Treasury::create([
            'user_id' => $this->owner->id,
            'branch_id' => $this->branchMain->id,
            'assigned_user_id' => $cashier->id,
            'name' => 'درج مقفول',
            'type' => TreasuryType::CASHIER_DRAWER->value,
            'balance' => 800,
            'is_active' => true,
        ]);

        $closedShift = Shift::create([
            'user_id' => $this->owner->id,
            'created_by' => $cashier->id,
            'treasury_id' => $drawer->id,
            'shift_number' => 'SH-CLOSED-1',
            'status' => ShiftStatus::CLOSED->value,
            'opened_at' => now()->subHours(4),
            'closed_at' => now()->subHour(),
            'opening_balance' => 1000,
        ]);

        $expense = Expense::create([
            'user_id' => $this->owner->id,
            'created_by' => $cashier->id,
            'treasury_id' => $drawer->id,
            'shift_id' => $closedShift->id,
            'title' => 'صيانة طارئة',
            'category' => 'صيانة وإصلاحات',
            'amount' => 200,
            'payment_method' => PaymentMethod::CASH->value,
            'date' => now()->toDateString(),
        ]);

        foreach ([$cashier, $supervisor, $manager] as $staff) {
            Sanctum::actingAs($staff);
            $this->putJson("/api/expenses/{$expense->id}", [
                'title' => 'تعديل غير مصرح',
                'amount' => 100,
                'payment_method' => PaymentMethod::CASH->value,
                'date' => now()->toDateString(),
            ])->assertStatus(403);
            $this->deleteJson("/api/expenses/{$expense->id}")->assertStatus(403);
        }

        Sanctum::actingAs($this->owner);
        $this->putJson("/api/expenses/{$expense->id}", [
            'title' => 'تعديل الإدارة العليا',
            'amount' => 150,
            'payment_method' => PaymentMethod::CASH->value,
            'date' => now()->toDateString(),
        ])->assertOk();
        $this->assertEquals(850.0, (float) $drawer->fresh()->balance);
    }

    public function test_cumulative_over_return_guard_and_net_salesperson_commission(): void
    {
        $salesperson = $this->createStaff(UserRole::SALES, '01077000020', [
            'base_salary' => 3000,
            'commission_type' => CommissionType::PERCENTAGE_OF_SALES->value,
            'commission_rate' => 10,
        ]);
        $cashier = $this->createStaff(UserRole::CASHIER, '01077000021');

        $drawer = Treasury::create([
            'user_id' => $this->owner->id,
            'branch_id' => $this->branchMain->id,
            'assigned_user_id' => $cashier->id,
            'name' => 'درج المبيعات',
            'type' => TreasuryType::CASHIER_DRAWER->value,
            'balance' => 3000,
            'is_active' => true,
        ]);

        Shift::create([
            'user_id' => $this->owner->id,
            'created_by' => $cashier->id,
            'treasury_id' => $drawer->id,
            'shift_number' => 'SH-RET-1',
            'status' => ShiftStatus::OPEN->value,
            'opened_at' => now(),
            'opening_balance' => 3000,
        ]);

        // Original invoice: qty 2 @ 900 = 1800, credited to $salesperson
        $saleInvoice = Invoice::create([
            'user_id' => $this->owner->id,
            'branch_id' => $this->branchMain->id,
            'created_by' => $cashier->id,
            'salesperson_id' => $salesperson->id,
            'treasury_id' => $drawer->id,
            'invoice_number' => 'INV-00001',
            'type' => InvoiceType::SALE->value,
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'subtotal' => 1800,
            'discount' => 0,
            'tax' => 0,
            'shipping_amount' => 0,
            'total' => 1800,
            'paid_amount' => 1800,
            'remaining_amount' => 0,
            'payment_method' => PaymentMethod::CASH->value,
        ]);

        InvoiceItem::create([
            'invoice_id' => $saleInvoice->id,
            'product_id' => $this->product->id,
            'product_name' => $this->product->name,
            'quantity' => 2,
            'unit_price' => 900,
            'purchase_price_at_sale' => 400,
            'total' => 1800,
        ]);

        Sanctum::actingAs($cashier);

        // First partial return: qty 1 succeeds & inherits salesperson_id from parent
        $ret1 = $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE_RETURN->value,
            'parent_invoice_id' => $saleInvoice->id,
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::CASH->value,
            'paid_amount' => 900,
            'items' => [['product_id' => $this->product->id, 'quantity' => 1, 'unit_price' => 900]],
        ])->assertStatus(201);

        $this->assertEquals($salesperson->id, $ret1->json('data.salesperson_id'));

        // Lookup exposes remaining returnable_quantity = 1
        $lookup = $this->getJson('/api/invoices/by-number/1?for_return=1&return_type=' . InvoiceType::SALE_RETURN->value)
            ->assertOk();
        $this->assertEquals(1.0, (float) $lookup->json('data.items.0.returned_quantity'));
        $this->assertEquals(1.0, (float) $lookup->json('data.items.0.returnable_quantity'));

        // Attempting to return 2 more exceeds remaining qty -> 422
        $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE_RETURN->value,
            'parent_invoice_id' => $saleInvoice->id,
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::CASH->value,
            'paid_amount' => 1800,
            'items' => [['product_id' => $this->product->id, 'quantity' => 2, 'unit_price' => 900]],
        ])->assertStatus(422)->assertJsonPath('error_code', 'RETURN_QUANTITY_EXCEEDS_ORIGINAL');

        // Returning the remaining 1 succeeds -> net sales for salesperson becomes 1800 - 900 - 900 = 0
        $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE_RETURN->value,
            'parent_invoice_id' => $saleInvoice->id,
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::CASH->value,
            'paid_amount' => 900,
            'items' => [['product_id' => $this->product->id, 'quantity' => 1, 'unit_price' => 900]],
        ])->assertStatus(201);

        $payroll = app(PayrollService::class)->calculateMonthlyPayroll($salesperson, now()->format('Y-m'));
        $this->assertEquals(1800.0, (float) $payroll['gross_sales']);
        $this->assertEquals(1800.0, (float) $payroll['sale_returns']);
        $this->assertEquals(0.0, (float) $payroll['total_sales']);
        $this->assertEquals(0.0, (float) $payroll['commission_amount']);
    }

    public function test_expense_category_rbac_and_barcode_count_upper_cap(): void
    {
        $cashier = $this->createStaff(UserRole::CASHIER, '01077000030');
        $supervisor = $this->createStaff(UserRole::SUPERVISOR, '01077000031');
        $mandob = $this->createStaff(UserRole::MANDOB, '01077000032');
        $manager = $this->createStaff(UserRole::MANAGER, '01077000033');

        $cat = ExpenseCategory::create(['user_id' => $this->owner->id, 'name' => 'ضيافة مكتب', 'is_default' => false]);

        Sanctum::actingAs($mandob);
        $this->postJson('/api/expense-categories', ['name' => 'تصنيف مندوب'])->assertStatus(403);
        $this->putJson("/api/expense-categories/{$cat->id}", ['name' => 'تعديل مندوب'])->assertStatus(403);
        $this->deleteJson("/api/expense-categories/{$cat->id}")->assertStatus(403);

        foreach ([$cashier, $supervisor] as $nonAdmin) {
            Sanctum::actingAs($nonAdmin);
            $this->deleteJson("/api/expense-categories/{$cat->id}")->assertStatus(403);
        }

        // Barcode cap rejects > 100
        Sanctum::actingAs($cashier);
        $this->getJson('/api/barcodes/generate?count=500')->assertStatus(422);

        // Manager can delete expense category
        Sanctum::actingAs($manager);
        $this->deleteJson("/api/expense-categories/{$cat->id}")->assertOk();
    }
}
