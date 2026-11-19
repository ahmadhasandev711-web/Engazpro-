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

class InvoiceReturnLookupAndNumberingTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Branch $branchMain;
    private Branch $branchSecond;
    private Product $product;
    private Party $customer;
    private Party $supplier;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'role' => UserRole::OWNER->value,
            'phone' => '01088000001',
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
            'name' => 'فرع المعادي',
            'code' => 'BR-1',
            'type' => BranchType::STORE->value,
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->branchSecond = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع الزمالك',
            'code' => 'BR-2',
            'type' => BranchType::STORE->value,
            'is_main' => false,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'حذاء رياضي',
            'code' => 'SHOE-1',
            'type' => ProductType::STANDARD->value,
            'purchase_price' => 300,
            'regular_price' => 600,
            'sale_price' => 600,
            'quantity' => 40,
            'unit' => 'قطعة',
        ]);

        BranchStock::create(['branch_id' => $this->branchMain->id, 'product_id' => $this->product->id, 'quantity' => 20]);
        BranchStock::create(['branch_id' => $this->branchSecond->id, 'product_id' => $this->product->id, 'quantity' => 20]);

        $this->customer = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'أحمد محمود',
            'type' => PartyType::CUSTOMER->value,
            'balance' => 0,
        ]);

        $this->supplier = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'مصنع الجلود',
            'type' => PartyType::SUPPLIER->value,
            'balance' => 0,
        ]);
    }

    private function createStaff(UserRole $role, Branch $branch, string $phone, array $extra = []): User
    {
        return User::factory()->create([
            'owner_id' => $this->owner->id,
            'branch_id' => $branch->id,
            'role' => $role->value,
            'phone' => $phone,
            'status' => UserStatus::ACTIVE->value,
            ...$extra,
        ]);
    }

    private function createSaleInvoice(User $creator, Branch $branch, string $invoiceNumber, float $total = 600): Invoice
    {
        $treasury = Treasury::firstOrCreate(
            ['user_id' => $this->owner->id, 'branch_id' => $branch->id, 'type' => TreasuryType::BRANCH_SAFE->value],
            ['name' => "خزينة {$branch->name}", 'balance' => 2000, 'is_active' => true]
        );

        $invoice = Invoice::create([
            'user_id' => $this->owner->id,
            'branch_id' => $branch->id,
            'created_by' => $creator->id,
            'salesperson_id' => $creator->id,
            'treasury_id' => $treasury->id,
            'invoice_number' => $invoiceNumber,
            'type' => InvoiceType::SALE->value,
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'subtotal' => $total,
            'discount' => 0,
            'tax' => 0,
            'shipping_amount' => 0,
            'total' => $total,
            'paid_amount' => $total,
            'remaining_amount' => 0,
            'payment_method' => PaymentMethod::CASH->value,
        ]);

        InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'product_id' => $this->product->id,
            'product_name' => $this->product->name,
            'quantity' => 1,
            'unit_price' => $total,
            'purchase_price_at_sale' => 300,
            'total' => $total,
        ]);

        return $invoice;
    }

    public function test_evening_cashier_can_lookup_colleague_and_owner_invoices_in_same_branch_by_short_number_and_return(): void
    {
        $cashierMorning = $this->createStaff(UserRole::CASHIER, $this->branchMain, '01088000010');
        $cashierEvening = $this->createStaff(UserRole::CASHIER, $this->branchMain, '01088000011');

        $drawerEvening = Treasury::create([
            'user_id' => $this->owner->id,
            'branch_id' => $this->branchMain->id,
            'assigned_user_id' => $cashierEvening->id,
            'name' => 'درج مسائي',
            'type' => TreasuryType::CASHIER_DRAWER->value,
            'balance' => 1500,
            'is_active' => true,
        ]);

        Shift::create([
            'user_id' => $this->owner->id,
            'created_by' => $cashierEvening->id,
            'treasury_id' => $drawerEvening->id,
            'shift_number' => 'SH-EV-01',
            'status' => ShiftStatus::OPEN->value,
            'opened_at' => now(),
            'opening_balance' => 1500,
        ]);

        $morningInvoice = $this->createSaleInvoice($cashierMorning, $this->branchMain, 'INV-00001');
        $ownerInvoice = $this->createSaleInvoice($this->owner, $this->branchMain, 'INV-00012');

        Sanctum::actingAs($cashierEvening);

        // Regular index & view still protect per-cashier privacy
        $listIds = collect($this->getJson('/api/invoices')->assertOk()->json('data'))->pluck('id')->all();
        $this->assertNotContains($morningInvoice->id, $listIds);
        $this->getJson("/api/invoices/by-number/INV-00001")->assertStatus(403);

        // Return lookup supports short digits (1, 001, inv-1, 12) for same-branch colleague & owner invoices
        foreach (['1', '001', 'inv-1', 'INV-00001'] as $query) {
            $res = $this->getJson("/api/invoices/by-number/{$query}?for_return=1&return_type=" . InvoiceType::SALE_RETURN->value)
                ->assertOk();
            $this->assertEquals($morningInvoice->id, $res->json('data.id'));
        }

        $ownerRes = $this->getJson('/api/invoices/by-number/12?for_return=1&return_type=' . InvoiceType::SALE_RETURN->value)
            ->assertOk();
        $this->assertEquals($ownerInvoice->id, $ownerRes->json('data.id'));

        // Evening cashier completes parent-linked return AND standalone free return
        $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE_RETURN->value,
            'parent_invoice_id' => $morningInvoice->id,
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::CASH->value,
            'paid_amount' => 600,
            'items' => [['product_id' => $this->product->id, 'quantity' => 1, 'unit_price' => 600]],
        ])->assertStatus(201);

        $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE_RETURN->value,
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::CASH->value,
            'paid_amount' => 300,
            'items' => [['product_id' => $this->product->id, 'quantity' => 1, 'unit_price' => 300]],
        ])->assertStatus(201);

        // Database still stores canonical INV-00001 format untouched
        $this->assertEquals('INV-00001', $morningInvoice->fresh()->invoice_number);
    }

    public function test_cashier_blocked_from_cross_branch_return_lookup_and_purchase_invoices(): void
    {
        $cashierMain = $this->createStaff(UserRole::CASHIER, $this->branchMain, '01088000020');
        $cashierSecond = $this->createStaff(UserRole::CASHIER, $this->branchSecond, '01088000021');

        $otherBranchInvoice = $this->createSaleInvoice($cashierSecond, $this->branchSecond, 'INV-00055');
        $mainTreasury = Treasury::create([
            'user_id' => $this->owner->id,
            'name' => 'الخزينة الرئيسية',
            'type' => TreasuryType::MAIN->value,
            'balance' => 150000,
            'is_active' => true,
        ]);

        $purchaseInvoice = Invoice::create([
            'user_id' => $this->owner->id,
            'branch_id' => $this->branchMain->id,
            'created_by' => $this->owner->id,
            'salesperson_id' => null,
            'treasury_id' => $mainTreasury->id,
            'invoice_number' => 'PUR-00007',
            'type' => InvoiceType::PURCHASE->value,
            'party_id' => $this->supplier->id,
            'date' => now()->toDateString(),
            'subtotal' => 10000,
            'discount' => 0,
            'tax' => 0,
            'shipping_amount' => 0,
            'total' => 10000,
            'paid_amount' => 10000,
            'remaining_amount' => 0,
            'payment_method' => PaymentMethod::CASH->value,
        ]);

        Sanctum::actingAs($cashierMain);

        $this->getJson('/api/invoices/by-number/55?for_return=1&return_type=' . InvoiceType::SALE_RETURN->value)
            ->assertStatus(403);

        $this->getJson('/api/invoices/by-number/PUR-00007?for_return=1&return_type=' . InvoiceType::SALE_RETURN->value)
            ->assertStatus(403);

        // Manager can look up purchase invoice in own branch via short digits too
        $managerMain = $this->createStaff(UserRole::MANAGER, $this->branchMain, '01088000022');
        Sanctum::actingAs($managerMain);

        $purRes = $this->getJson('/api/invoices/by-number/7?for_return=1&return_type=' . InvoiceType::PURCHASE_RETURN->value)
            ->assertOk();
        $this->assertEquals($purchaseInvoice->id, $purRes->json('data.id'));
    }

    public function test_large_purchase_invoice_never_triggers_sales_commission(): void
    {
        $salesEmployee = $this->createStaff(UserRole::SALES, $this->branchMain, '01088000030', [
            'base_salary' => 4000,
            'commission_type' => CommissionType::PERCENTAGE_OF_SALES->value,
            'commission_rate' => 5,
        ]);

        $mainTreasury = Treasury::create([
            'user_id' => $this->owner->id,
            'name' => 'خزينة المشتريات',
            'type' => TreasuryType::MAIN->value,
            'balance' => 200000,
            'is_active' => true,
        ]);

        Sanctum::actingAs($this->owner);
        $createdPurchase = $this->postJson('/api/invoices', [
            'type' => InvoiceType::PURCHASE->value,
            'branch_id' => $this->branchMain->id,
            'party_id' => $this->supplier->id,
            'salesperson_id' => $salesEmployee->id,
            'treasury_id' => $mainTreasury->id,
            'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::CASH->value,
            'paid_amount' => 100000,
            'items' => [['product_id' => $this->product->id, 'quantity' => 100, 'unit_price' => 1000]],
        ])->assertStatus(201);

        $this->assertNull($createdPurchase->json('data.salesperson_id'));

        $payroll = app(PayrollService::class)->calculateMonthlyPayroll($salesEmployee, now()->format('Y-m'));
        $this->assertEquals(0.0, (float) $payroll['total_sales']);
        $this->assertEquals(0, (int) $payroll['invoices_count']);
        $this->assertEquals(0.0, (float) $payroll['commission_amount']);
    }
}
