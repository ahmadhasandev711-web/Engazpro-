<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\InvoiceType;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\ProductType;
use App\Enums\SubscriptionStatus;
use App\Enums\TreasuryType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Party;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\Treasury;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SaasTenantAndBranchPerformanceIsolationTest extends TestCase
{
    use RefreshDatabase;

    private User $ownerA;
    private User $ownerB;
    private Branch $branchA1;
    private Branch $branchA2;
    private Branch $branchB1;
    private Treasury $mainTreasuryA;
    private Treasury $branchSafeA1;
    private Treasury $branchSafeA2;
    private Treasury $branchSafeB1;
    private Product $productA;
    private Product $productB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ownerA = $this->createOwner('01066000001');
        $this->ownerB = $this->createOwner('01066000002');

        $this->branchA1 = $this->createBranch($this->ownerA, 'فرع A1', 'BR-A1', true);
        $this->branchA2 = $this->createBranch($this->ownerA, 'فرع A2', 'BR-A2', false);
        $this->branchB1 = $this->createBranch($this->ownerB, 'فرع B1', 'BR-B1', true);

        $this->mainTreasuryA = $this->createTreasury($this->ownerA, TreasuryType::MAIN, null, 50000);
        $this->branchSafeA1 = $this->createTreasury($this->ownerA, TreasuryType::BRANCH_SAFE, $this->branchA1, 10000);
        $this->branchSafeA2 = $this->createTreasury($this->ownerA, TreasuryType::BRANCH_SAFE, $this->branchA2, 10000);
        $this->branchSafeB1 = $this->createTreasury($this->ownerB, TreasuryType::BRANCH_SAFE, $this->branchB1, 10000);

        $this->productA = Product::create([
            'user_id' => $this->ownerA->id,
            'name' => 'منتج مؤسسة A',
            'code' => 'SAAS-A1',
            'type' => ProductType::STANDARD->value,
            'purchase_price' => 100,
            'regular_price' => 250,
            'sale_price' => 250,
            'quantity' => 100,
            'unit' => 'قطعة',
        ]);
        $this->productB = Product::create([
            'user_id' => $this->ownerB->id,
            'name' => 'منتج مؤسسة B',
            'code' => 'SAAS-B1',
            'type' => ProductType::STANDARD->value,
            'purchase_price' => 500,
            'regular_price' => 900,
            'sale_price' => 900,
            'quantity' => 100,
            'unit' => 'قطعة',
        ]);

        BranchStock::create(['branch_id' => $this->branchA1->id, 'product_id' => $this->productA->id, 'quantity' => 50]);
        BranchStock::create(['branch_id' => $this->branchA2->id, 'product_id' => $this->productA->id, 'quantity' => 50]);
        BranchStock::create(['branch_id' => $this->branchB1->id, 'product_id' => $this->productB->id, 'quantity' => 50]);
    }

    private function createOwner(string $phone): User
    {
        $owner = User::factory()->create([
            'role' => UserRole::OWNER->value,
            'phone' => $phone,
            'status' => UserStatus::ACTIVE->value,
        ]);

        Subscription::create([
            'user_id' => $owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => SubscriptionStatus::ACTIVE->value,
            'plan' => 'PRO',
        ]);

        return $owner;
    }

    private function createBranch(User $owner, string $name, string $code, bool $isMain): Branch
    {
        return Branch::create([
            'user_id' => $owner->id,
            'name' => $name,
            'code' => $code,
            'type' => BranchType::STORE->value,
            'is_main' => $isMain,
            'is_active' => true,
        ]);
    }

    private function createTreasury(User $owner, TreasuryType $type, ?Branch $branch, float $balance): Treasury
    {
        return Treasury::create([
            'user_id' => $owner->id,
            'branch_id' => $branch?->id,
            'name' => "خزينة {$type->value} " . uniqid(),
            'type' => $type->value,
            'balance' => $balance,
            'is_active' => true,
        ]);
    }

    private function seedSale(User $owner, User $creator, Branch $branch, Treasury $treasury, Product $product, string $invNo, float $qty, float $price, float $cost): void
    {
        $total = $qty * $price;
        $inv = Invoice::create([
            'user_id' => $owner->id,
            'branch_id' => $branch->id,
            'created_by' => $creator->id,
            'salesperson_id' => $creator->id,
            'treasury_id' => $treasury->id,
            'invoice_number' => $invNo,
            'type' => InvoiceType::SALE->value,
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
            'invoice_id' => $inv->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => $qty,
            'unit_price' => $price,
            'purchase_price_at_sale' => $cost,
            'total' => $total,
        ]);
    }

    public function test_saas_reports_expenses_and_cogs_strictly_isolated_across_tenants_and_branches(): void
    {
        $managerA1 = User::factory()->create([
            'owner_id' => $this->ownerA->id,
            'branch_id' => $this->branchA1->id,
            'role' => UserRole::MANAGER->value,
            'phone' => '01066000010',
            'status' => UserStatus::ACTIVE->value,
        ]);
        $managerA2 = User::factory()->create([
            'owner_id' => $this->ownerA->id,
            'branch_id' => $this->branchA2->id,
            'role' => UserRole::MANAGER->value,
            'phone' => '01066000011',
            'status' => UserStatus::ACTIVE->value,
        ]);

        // Tenant A Branch 1: sales = 1000, COGS = 400
        $this->seedSale($this->ownerA, $managerA1, $this->branchA1, $this->branchSafeA1, $this->productA, 'INV-A1', 4, 250, 100);
        // Tenant A Branch 2: sales = 2500, COGS = 1000
        $this->seedSale($this->ownerA, $managerA2, $this->branchA2, $this->branchSafeA2, $this->productA, 'INV-A2', 10, 250, 100);
        // Tenant B Branch 1: sales = 9000, COGS = 5000
        $this->seedSale($this->ownerB, $this->ownerB, $this->branchB1, $this->branchSafeB1, $this->productB, 'INV-B1', 10, 900, 500);

        // Expenses: A1 branch expense (120) + A1 expense via global treasury (80) = 200 for A1; A2 = 500; B1 = 3000
        Expense::create(['user_id' => $this->ownerA->id, 'created_by' => $managerA1->id, 'treasury_id' => $this->branchSafeA1->id, 'title' => 'مصروف فرع A1', 'category' => 'إيجار', 'amount' => 120, 'payment_method' => PaymentMethod::CASH->value, 'date' => now()->toDateString()]);
        Expense::create(['user_id' => $this->ownerA->id, 'created_by' => $managerA1->id, 'treasury_id' => $this->mainTreasuryA->id, 'title' => 'نثرية A1', 'category' => 'إيجار', 'amount' => 80, 'payment_method' => PaymentMethod::INSTAPAY->value, 'date' => now()->toDateString()]);
        Expense::create(['user_id' => $this->ownerA->id, 'created_by' => $managerA2->id, 'treasury_id' => $this->branchSafeA2->id, 'title' => 'مصروف فرع A2', 'category' => 'صيانة', 'amount' => 500, 'payment_method' => PaymentMethod::CASH->value, 'date' => now()->toDateString()]);
        Expense::create(['user_id' => $this->ownerB->id, 'created_by' => $this->ownerB->id, 'treasury_id' => $this->branchSafeB1->id, 'title' => 'مصروف B1', 'category' => 'إيجار', 'amount' => 3000, 'payment_method' => PaymentMethod::CASH->value, 'date' => now()->toDateString()]);

        // Owner A querying profit & closing statements for branch A1 only
        Sanctum::actingAs($this->ownerA);
        $profitA1 = $this->getJson("/api/reports/profit?branch_id={$this->branchA1->id}")->assertOk()->json('data');
        $this->assertEquals(1000.0, (float) $profitA1['sales']['net_sales']);
        $this->assertEquals(400.0, (float) $profitA1['cogs']['net_cogs']);
        $this->assertEquals(200.0, (float) $profitA1['profit']['total_expenses']);
        $this->assertEquals(400.0, (float) $profitA1['profit']['net_profit']);

        $closingA1 = $this->getJson("/api/reports/financial-closing?branch_id={$this->branchA1->id}")->assertOk()->json('data');
        $this->assertEquals(200.0, (float) $closingA1['income_statement']['expenses_by_category'][0]['total_amount']);

        // Manager A1 trying to query A2 or Tenant B branch_id stays locked to A1
        Sanctum::actingAs($managerA1);
        $salesLocked = $this->getJson("/api/reports/sales?branch_id={$this->branchA2->id}")->assertOk()->json('data');
        $this->assertEquals(1000.0, (float) $salesLocked['total_sales']);

        $expensesLocked = $this->getJson("/api/expenses?branch_id={$this->branchB1->id}")->assertOk();
        $this->assertEquals(200.0, (float) $expensesLocked->json('summary.total_amount'));

        // Tenant B sees strictly its own figures
        Sanctum::actingAs($this->ownerB);
        DB::enableQueryLog();
        $profitB = $this->getJson('/api/reports/profit')->assertOk()->json('data');
        DB::disableQueryLog();
        $this->assertEquals(9000.0, (float) $profitB['sales']['net_sales']);
        $this->assertEquals(5000.0, (float) $profitB['cogs']['net_cogs']);
        $this->assertEquals(3000.0, (float) $profitB['profit']['total_expenses']);
    }
}
