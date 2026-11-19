<?php

namespace App\Services;

use App\Enums\PartyType;
use App\Enums\StockTransferStatus;
use App\Enums\TreasuryType;
use App\Models\Branch;
use App\Models\Expense;
use App\Models\Party;
use App\Models\PayrollPayout;
use App\Models\Product;
use App\Models\Treasury;
use App\Models\User;
use App\Support\Money;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class FinancialClosingService
{
    public function __construct(
        protected ReportService $reportService
    ) {}

    public function getClosingStatements(User $user, ?string $fromDate = null, ?string $toDate = null, ?int $branchId = null): array
    {
        $accountId = $user->getAccountId();
        $scopedBranchId = $branchId ? Branch::where('user_id', $accountId)->whereKey($branchId)->value('id') : null;

        return [
            'period' => ['from_date' => $fromDate, 'to_date' => $toDate, 'branch_id' => $scopedBranchId ? (int) $scopedBranchId : null],
            'income_statement' => $this->buildIncomeStatement($accountId, $fromDate, $toDate, $scopedBranchId ? (int) $scopedBranchId : null),
            'balance_snapshot' => $this->buildBalanceSnapshot($accountId),
        ];
    }

    private function buildIncomeStatement(int $accountId, ?string $fromDate, ?string $toDate, ?int $branchId): array
    {
        $profit = $this->reportService->getProfitReport($fromDate, $toDate, $branchId);
        $sales = $profit['sales'];
        $cogs = $profit['cogs'];
        $netSalesMoney = Money::of($sales['net_sales']);
        $grossProfitMoney = Money::of($profit['profit']['gross_profit']);
        $grossMargin = $netSalesMoney->isPositive() ? round(($grossProfitMoney->getAmount() / $netSalesMoney->getAmount()) * 100, 2) : 0.0;

        $expensesByCategory = $this->aggregateExpensesByCategory($accountId, $fromDate, $toDate, $branchId);
        $currentMonth = Carbon::now()->format('Y-m');
        $disbursedPayroll = Money::of(PayrollPayout::where('user_id', $accountId)->where('month', $currentMonth)->sum('net_paid') ?? 0)->getAmount();

        return [
            'gross_sales' => $sales['gross_sales'], 'sales_discounts' => $sales['discounts'] ?? 0.0,
            'sale_returns' => $sales['sale_returns'], 'net_sales' => $sales['net_sales'],
            'shipping_revenue' => $sales['shipping_revenue'] ?? 0.0,
            'cogs_sales' => $cogs['cogs_sales'], 'cogs_returns' => $cogs['cogs_returns'], 'net_cogs' => $cogs['net_cogs'],
            'gross_profit' => $profit['profit']['gross_profit'], 'gross_margin' => $grossMargin,
            'expenses_by_category' => $expensesByCategory, 'total_expenses' => $profit['profit']['total_expenses'],
            'net_profit' => $profit['profit']['net_profit'], 'net_margin' => $profit['profit']['profit_margin'],
            'pending_payroll_reference' => ['month' => $currentMonth, 'disbursed_this_month' => $disbursedPayroll],
        ];
    }

    private function aggregateExpensesByCategory(int $accountId, ?string $fromDate, ?string $toDate, ?int $branchId): array
    {
        $query = Expense::where('user_id', $accountId)
            ->when($fromDate, fn ($q) => $q->where('date', '>=', $fromDate))
            ->when($toDate, fn ($q) => $q->where('date', '<=', $toDate . ' 23:59:59'));

        app(BranchScopeService::class)->applyDirectBranchIdToTreasuryOrCreator($query, $accountId, $branchId);

        return $query->selectRaw("COALESCE(NULLIF(category, ''), 'مصروفات عامة') as cat_name, COUNT(*) as cnt, COALESCE(SUM(amount), 0) as sum_amount")
            ->groupBy('cat_name')
            ->orderByDesc('sum_amount')
            ->get()
            ->map(fn ($row) => ['category' => (string) $row->cat_name, 'count' => (int) $row->cnt, 'total_amount' => Money::of($row->sum_amount ?? 0)->getAmount()])
            ->values()
            ->all();
    }

    private function buildBalanceSnapshot(int $accountId): array
    {
        [$treasuriesByType, $totalCash, $drawings] = $this->summarizeTreasuries($accountId);
        $inventoryCost = $this->calculateInventoryCostValue($accountId);
        $inTransitCost = $this->calculateInTransitCostValue($accountId);
        $partyTotals = $this->summarizePartyBalances($accountId);

        $totalAssets = Money::of($totalCash)->add($inventoryCost)->add($inTransitCost)
            ->add($partyTotals['customer_receivables'])->add($partyTotals['courier_receivables']);
        $totalLiabilities = Money::of($partyTotals['supplier_payables'])
            ->add($partyTotals['customer_credits'])->add($partyTotals['courier_payables']);

        return $this->assembleBalanceSnapshot($treasuriesByType, $totalCash, $inventoryCost, $inTransitCost, $partyTotals, $totalAssets, $totalLiabilities, $drawings);
    }

    private function assembleBalanceSnapshot(
        array $treasuriesByType, Money $totalCash, Money $inventoryCost, Money $inTransitCost,
        array $partyTotals, Money $totalAssets, Money $totalLiabilities, Money $drawings
    ): array {
        return [
            'as_of' => Carbon::now()->toIso8601String(),
            'assets' => [
                'treasuries_by_type' => $treasuriesByType, 'total_cash_and_banks' => $totalCash->getAmount(),
                'inventory_cost_value' => $inventoryCost->getAmount(), 'in_transit_inventory_value' => $inTransitCost->getAmount(),
                'customer_receivables' => $partyTotals['customer_receivables']->getAmount(),
                'courier_receivables' => $partyTotals['courier_receivables']->getAmount(),
                'total_assets' => $totalAssets->getAmount(),
            ],
            'liabilities' => [
                'supplier_payables' => $partyTotals['supplier_payables']->getAmount(),
                'customer_credits' => $partyTotals['customer_credits']->getAmount(),
                'courier_payables' => $partyTotals['courier_payables']->getAmount(),
                'total_liabilities' => $totalLiabilities->getAmount(),
            ],
            'net_working_capital' => $totalAssets->subtract($totalLiabilities)->getAmount(),
            'owner_drawings_total' => $drawings->getAmount(),
        ];
    }

    /**
     * @return array{0: list<array{type: string, label: string, balance: float}>, 1: Money, 2: Money}
     */
    private function summarizeTreasuries(int $accountId): array
    {
        $rows = Treasury::where('user_id', $accountId)->where('is_active', true)
            ->selectRaw('type, COALESCE(SUM(balance), 0) as sum_balance')
            ->groupBy('type')->get();

        $byType = [];
        $cashTotal = Money::zero();
        $drawings = Money::zero();
        foreach ($rows as $row) {
            $type = $row->type instanceof TreasuryType ? $row->type : TreasuryType::from((string) $row->type);
            $bal = Money::of($row->sum_balance ?? 0);
            if ($type === TreasuryType::OWNER_DRAWINGS) {
                $drawings = $drawings->add(abs($bal->getAmount()));
                continue;
            }
            $cashTotal = $cashTotal->add($bal);
            $byType[] = ['type' => $type->value, 'label' => $type->label(), 'balance' => $bal->getAmount()];
        }

        return [$byType, $cashTotal, $drawings];
    }

    private function calculateInventoryCostValue(int $accountId): Money
    {
        $hasBranches = Branch::where('user_id', $accountId)->exists();
        if (!$hasBranches) {
            return Money::of(Product::where('user_id', $accountId)->selectRaw('COALESCE(SUM(quantity * COALESCE(purchase_price, 0)), 0) as val')->value('val') ?? 0);
        }

        $branchCost = DB::table('branch_stocks')
            ->join('branches', 'branches.id', '=', 'branch_stocks.branch_id')
            ->join('products', 'products.id', '=', 'branch_stocks.product_id')
            ->leftJoin('product_variants', 'product_variants.id', '=', 'branch_stocks.product_variant_id')
            ->where('branches.user_id', $accountId)
            ->whereNull('branches.deleted_at')
            ->whereNull('products.deleted_at')
            ->whereNull('product_variants.deleted_at')
            ->selectRaw('COALESCE(SUM(branch_stocks.quantity * COALESCE(NULLIF(product_variants.purchase_price, 0), products.purchase_price, 0)), 0) as val')
            ->value('val');

        return Money::of($branchCost ?? 0);
    }

    private function calculateInTransitCostValue(int $accountId): Money
    {
        $val = DB::table('stock_transfer_items')
            ->join('stock_transfers', 'stock_transfers.id', '=', 'stock_transfer_items.stock_transfer_id')
            ->join('products', 'products.id', '=', 'stock_transfer_items.product_id')
            ->leftJoin('product_variants', 'product_variants.id', '=', 'stock_transfer_items.product_variant_id')
            ->where('stock_transfers.user_id', $accountId)
            ->where('stock_transfers.status', StockTransferStatus::IN_TRANSIT->value)
            ->whereNull('products.deleted_at')
            ->selectRaw('COALESCE(SUM((stock_transfer_items.quantity_sent - COALESCE(stock_transfer_items.quantity_received, 0)) * COALESCE(NULLIF(product_variants.purchase_price, 0), products.purchase_price, 0)), 0) as val')
            ->value('val');

        return Money::of($val ?? 0);
    }

    private function summarizePartyBalances(int $accountId): array
    {
        $rows = Party::where('user_id', $accountId)
            ->selectRaw('type, COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) as pos, COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0) as neg')
            ->groupBy('type')->get()->keyBy('type');

        $cust = $rows->get(PartyType::CUSTOMER->value);
        $supp = $rows->get(PartyType::SUPPLIER->value);
        $cour = $rows->get(PartyType::COURIER->value);

        return [
            'customer_receivables' => Money::of($cust?->pos ?? 0),
            'customer_credits' => Money::of($cust?->neg ?? 0),
            'supplier_payables' => Money::of($supp?->pos ?? 0),
            'supplier_advances' => Money::of($supp?->neg ?? 0),
            'courier_receivables' => Money::of($cour?->pos ?? 0),
            'courier_payables' => Money::of($cour?->neg ?? 0),
        ];
    }
}
