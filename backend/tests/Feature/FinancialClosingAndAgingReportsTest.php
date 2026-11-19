<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\InvoiceType;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\ProductType;
use App\Enums\StockTransferStatus;
use App\Enums\SubscriptionStatus;
use App\Enums\TreasuryType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\LedgerEntry;
use App\Models\Party;
use App\Models\Product;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\Subscription;
use App\Models\Treasury;
use App\Models\User;
use App\Services\PayrollService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FinancialClosingAndAgingReportsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $branchManager;
    private Branch $mainBranch;
    private Branch $warehouseBranch;
    private Treasury $mainTreasury;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => UserRole::OWNER->value, 'owner_id' => null, 'status' => UserStatus::ACTIVE->value]);
        Subscription::create([
            'user_id' => $this->owner->id, 'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(), 'status' => SubscriptionStatus::ACTIVE->value, 'plan' => 'PRO',
        ]);

        $this->mainBranch = Branch::create([
            'user_id' => $this->owner->id, 'name' => 'الرئيسي', 'code' => 'M-1',
            'type' => BranchType::STORE->value, 'is_main' => true, 'is_active' => true,
        ]);
        $this->warehouseBranch = Branch::create([
            'user_id' => $this->owner->id, 'name' => 'المخزن', 'code' => 'W-1',
            'type' => BranchType::WAREHOUSE->value, 'is_main' => false, 'is_active' => true,
        ]);
        $this->branchManager = User::factory()->create([
            'owner_id' => $this->owner->id, 'branch_id' => $this->mainBranch->id,
            'role' => UserRole::MANAGER->value, 'status' => UserStatus::ACTIVE->value,
        ]);

        $this->mainTreasury = Treasury::create([
            'user_id' => $this->owner->id, 'name' => 'الخزينة الرئيسية',
            'type' => TreasuryType::MAIN->value, 'balance' => 10000, 'is_active' => true,
        ]);
        Treasury::create([
            'user_id' => $this->owner->id, 'name' => 'مسحوبات المالك',
            'type' => TreasuryType::OWNER_DRAWINGS->value, 'balance' => 1500, 'is_active' => true,
        ]);
    }

    public function test_financial_closing_computes_accurate_pnl_without_payroll_double_counting_and_includes_in_transit_assets(): void
    {
        $product = Product::create([
            'user_id' => $this->owner->id, 'name' => 'جاكيت', 'type' => ProductType::STANDARD->value,
            'purchase_price' => 200, 'regular_price' => 500, 'sale_price' => 500, 'quantity' => 15,
        ]);
        BranchStock::create(['branch_id' => $this->mainBranch->id, 'product_id' => $product->id, 'quantity' => 10]);

        $transfer = StockTransfer::create([
            'user_id' => $this->owner->id, 'created_by' => $this->owner->id,
            'from_branch_id' => $this->mainBranch->id, 'to_branch_id' => $this->warehouseBranch->id,
            'transfer_number' => 'TRF-FIN-1', 'status' => StockTransferStatus::IN_TRANSIT->value,
        ]);
        StockTransferItem::create(['stock_transfer_id' => $transfer->id, 'product_id' => $product->id, 'quantity_sent' => 5]);

        $customer = Party::create(['user_id' => $this->owner->id, 'type' => PartyType::CUSTOMER->value, 'name' => 'عميل آجل', 'balance' => 600]);
        $supplier = Party::create(['user_id' => $this->owner->id, 'type' => PartyType::SUPPLIER->value, 'name' => 'مورد ملابس', 'balance' => 1000]);
        $courier = Party::create(['user_id' => $this->owner->id, 'type' => PartyType::COURIER->value, 'name' => 'بوسطة', 'balance' => 400]);

        $saleInv = Invoice::create([
            'user_id' => $this->owner->id, 'branch_id' => $this->mainBranch->id, 'party_id' => $customer->id,
            'created_by' => $this->owner->id, 'invoice_number' => 'INV-CLS-1',
            'type' => InvoiceType::SALE->value, 'payment_method' => PaymentMethod::CASH->value,
            'subtotal' => 2000, 'discount' => 100, 'total' => 1900, 'paid_amount' => 1900, 'date' => now()->toDateString(),
        ]);
        InvoiceItem::create([
            'invoice_id' => $saleInv->id, 'product_id' => $product->id, 'product_name' => $product->name,
            'quantity' => 4, 'unit_price' => 500, 'purchase_price_at_sale' => 200, 'total' => 2000,
        ]);

        Expense::create([
            'user_id' => $this->owner->id, 'created_by' => $this->owner->id, 'treasury_id' => $this->mainTreasury->id,
            'title' => 'إيجار المحل', 'category' => 'إيجار ومرافق', 'amount' => 300,
            'payment_method' => PaymentMethod::CASH->value, 'date' => now()->toDateString(),
        ]);

        $staff = User::factory()->create([
            'owner_id' => $this->owner->id, 'branch_id' => $this->mainBranch->id,
            'role' => UserRole::SALES->value, 'base_salary' => 500, 'status' => UserStatus::ACTIVE->value,
        ]);
        Sanctum::actingAs($this->owner);
        app(PayrollService::class)->disbursePayroll($this->owner, $staff, [
            'month' => now()->format('Y-m'),
            'treasury_id' => $this->mainTreasury->id,
            'payment_method' => PaymentMethod::CASH->value,
        ]);

        $res = $this->getJson('/api/reports/financial-closing')->assertOk()->json('data');

        // P&L: net_sales=1900, net_cogs=800, gross_profit=1100, expenses=(300 rent + 500 salary)=800 (NO double count!), net_profit=300
        $this->assertEquals(1900.0, (float) $res['income_statement']['net_sales']);
        $this->assertEquals(800.0, (float) $res['income_statement']['net_cogs']);
        $this->assertEquals(800.0, (float) $res['income_statement']['total_expenses']);
        $this->assertEquals(300.0, (float) $res['income_statement']['net_profit']);

        // Balance Snapshot: cash=(10000 - 500 disbursed salary)=9500, stock=10*200=2000, in_transit=5*200=1000, cust=600, courier=400 => assets=13500; liabilities=1000 => NWC=12500
        $this->assertEquals(9500.0, (float) $res['balance_snapshot']['assets']['total_cash_and_banks']);
        $this->assertEquals(2000.0, (float) $res['balance_snapshot']['assets']['inventory_cost_value']);
        $this->assertEquals(1000.0, (float) $res['balance_snapshot']['assets']['in_transit_inventory_value']);
        $this->assertEquals(13500.0, (float) $res['balance_snapshot']['assets']['total_assets']);
        $this->assertEquals(1000.0, (float) $res['balance_snapshot']['liabilities']['supplier_payables']);
        $this->assertEquals(12500.0, (float) $res['balance_snapshot']['net_working_capital']);
        $this->assertEquals(1500.0, (float) $res['balance_snapshot']['owner_drawings_total']);
    }

    public function test_receivables_payables_aging_and_strict_role_isolation(): void
    {
        $oldCustomer = Party::create(['user_id' => $this->owner->id, 'type' => PartyType::CUSTOMER->value, 'name' => 'عميل متأخر', 'balance' => 1200]);
        $recentSupplier = Party::create(['user_id' => $this->owner->id, 'type' => PartyType::SUPPLIER->value, 'name' => 'مورد حديث', 'balance' => 700]);

        LedgerEntry::create([
            'user_id' => $this->owner->id, 'party_id' => $oldCustomer->id, 'source_type' => 'INVOICE', 'source_id' => 1,
            'date' => now()->subDays(75)->toDateString(), 'description' => 'فاتورة قديمة', 'debit' => 1200, 'credit' => 0, 'balance_after' => 1200,
        ]);
        LedgerEntry::create([
            'user_id' => $this->owner->id, 'party_id' => $recentSupplier->id, 'source_type' => 'INVOICE', 'source_id' => 2,
            'date' => now()->subDays(10)->toDateString(), 'description' => 'توريد', 'debit' => 0, 'credit' => 700, 'balance_after' => 700,
        ]);

        // Branch-locked manager must be denied both closing statements and global receivables/payables
        Sanctum::actingAs($this->branchManager);
        $this->getJson('/api/reports/financial-closing')->assertStatus(403);
        $this->getJson('/api/reports/receivables-payables')->assertStatus(403);

        Sanctum::actingAs($this->owner);
        $aging = $this->getJson('/api/reports/receivables-payables')->assertOk()->json('data');
        $this->assertEquals(1200.0, (float) $aging['aging']['customers']['days_60_plus']);
        $this->assertEquals(700.0, (float) $aging['aging']['suppliers']['current_0_30']);
        $this->assertEquals(500.0, (float) $aging['summary']['net_trade_position']);
    }
}
