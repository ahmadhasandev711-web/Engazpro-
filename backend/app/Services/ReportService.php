<?php

namespace App\Services;

use App\Enums\InvoiceType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentType;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ReportService
{
    /**
     * تقرير الأرباح الشامل (المبيعات، تكلفة البضاعة المباعة COGS، المصروفات، وصافي الأرباح)
     */
    public function getProfitReport(?string $fromDate = null, ?string $toDate = null, ?int $branchId = null): array
    {
        $salesQuery = $this->applyDateBounds(Invoice::where('type', InvoiceType::SALE->value)->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId)), $fromDate, $toDate);
        $returnsQuery = $this->applyDateBounds(Invoice::where('type', InvoiceType::SALE_RETURN->value)->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId)), $fromDate, $toDate);
        $expensesQuery = $this->applyDateBounds($this->applyCashFlowRelationBranch(Expense::query(), $branchId), $fromDate, $toDate);

        $grossSales = Money::of($salesQuery->sum('total') ?? 0);
        $saleReturns = Money::of($returnsQuery->sum('total') ?? 0);
        $netSales = $grossSales->subtract($saleReturns);
        $cogsSales = $this->calculateCogs(InvoiceType::SALE->value, $fromDate, $toDate, $branchId);
        $cogsReturns = $this->calculateCogs(InvoiceType::SALE_RETURN->value, $fromDate, $toDate, $branchId);
        $netCogs = $cogsSales->subtract($cogsReturns);
        $grossProfit = $netSales->subtract($netCogs);
        $totalExpenses = Money::of($expensesQuery->sum('amount') ?? 0);
        $netProfit = $grossProfit->subtract($totalExpenses);

        return $this->assembleProfitReportPayload($fromDate, $toDate, $salesQuery, $returnsQuery, $expensesQuery, $grossSales, $saleReturns, $netSales, $cogsSales, $cogsReturns, $netCogs, $grossProfit, $totalExpenses, $netProfit);
    }

    private function assembleProfitReportPayload(
        ?string $fromDate, ?string $toDate, $salesQuery, $returnsQuery, $expensesQuery,
        Money $grossSales, Money $saleReturns, Money $netSales, Money $cogsSales, Money $cogsReturns, Money $netCogs,
        Money $grossProfit, Money $totalExpenses, Money $netProfit
    ): array {
        $netSalesAmount = $netSales->getAmount();
        $profitMargin = $netSalesAmount > 0 ? round(($netProfit->getAmount() / $netSalesAmount) * 100, 2) : 0;

        return [
            'period' => ['from_date' => $fromDate, 'to_date' => $toDate],
            'sales' => [
                'gross_sales' => $grossSales->getAmount(), 'product_sales' => Money::of($salesQuery->sum('subtotal') ?? 0)->getAmount(),
                'shipping_revenue' => Money::of($salesQuery->sum('shipping_amount') ?? 0)->getAmount(),
                'discounts' => Money::of($salesQuery->sum('discount') ?? 0)->getAmount(),
                'sale_returns' => $saleReturns->getAmount(), 'net_sales' => $netSalesAmount,
                'sales_count' => $salesQuery->count(), 'returns_count' => $returnsQuery->count(),
            ],
            'cogs' => ['cogs_sales' => $cogsSales->getAmount(), 'cogs_returns' => $cogsReturns->getAmount(), 'net_cogs' => $netCogs->getAmount()],
            'profit' => ['gross_profit' => $grossProfit->getAmount(), 'total_expenses' => $totalExpenses->getAmount(), 'expenses_count' => $expensesQuery->count(), 'net_profit' => $netProfit->getAmount(), 'profit_margin' => $profitMargin],
        ];
    }

    /**
     * حساب تكلفة البضاعة لنوع فاتورة محدد
     */
    protected function calculateCogs(string $invoiceType, ?string $fromDate, ?string $toDate, ?int $branchId = null): Money
    {
        $rawSum = InvoiceItem::whereHas('invoice', function ($q) use ($invoiceType, $fromDate, $toDate, $branchId) {
            $q->where('type', $invoiceType)
              ->when($branchId !== null, fn($iq) => $iq->where('branch_id', $branchId))
              ->when($fromDate, fn($iq) => $iq->where('date', '>=', $fromDate))
              ->when($toDate, fn($iq) => $iq->where('date', '<=', $toDate . ' 23:59:59'));
        })->sum(DB::raw('quantity * purchase_price_at_sale'));

        return Money::of($rawSum ?? 0);
    }

    /**
     * ملخص المبيعات وطرق الدفع
     */
    public function getSalesReport(User $user, ?string $fromDate = null, ?string $toDate = null, ?int $branchId = null): array
    {
        $base = Invoice::query()->when($user->isMandob(), fn($q) => $q->where('created_by', $user->id));
        app(BranchScopeService::class)->applyBranchFilter($base, $user, 'branch_id', $branchId);
        $query = $this->applyDateBounds($base, $fromDate, $toDate);
        $aggregates = (clone $query)->select('type', DB::raw('COALESCE(SUM(total), 0) as total_amount'), DB::raw('COALESCE(SUM(shipping_amount), 0) as shipping_amount'), DB::raw('COALESCE(SUM(paid_amount), 0) as paid_amount'), DB::raw('COALESCE(SUM(remaining_amount), 0) as remaining_amount'))->groupBy('type')->get()->keyBy('type');

        $saleRow = $aggregates->get(InvoiceType::SALE->value);
        $purchaseRow = $user->isMandob() ? null : $aggregates->get(InvoiceType::PURCHASE->value);
        $saleReturnRow = $aggregates->get(InvoiceType::SALE_RETURN->value);
        $purchaseReturnRow = $user->isMandob() ? null : $aggregates->get(InvoiceType::PURCHASE_RETURN->value);

        return [
            'total_sales' => Money::of($saleRow?->total_amount ?? 0)->getAmount(),
            'total_shipping' => Money::of($saleRow?->shipping_amount ?? 0)->getAmount(),
            'total_purchases' => Money::of($purchaseRow?->total_amount ?? 0)->getAmount(),
            'total_sale_returns' => Money::of($saleReturnRow?->total_amount ?? 0)->getAmount(),
            'total_purchase_returns' => Money::of($purchaseReturnRow?->total_amount ?? 0)->getAmount(),
            'sales_paid' => Money::of($saleRow?->paid_amount ?? 0)->getAmount(),
            'sales_remaining' => Money::of($saleRow?->remaining_amount ?? 0)->getAmount(),
            'payment_methods' => $this->aggregateSalesByPaymentMethod($query),
        ];
    }

    private function aggregateSalesByPaymentMethod(Builder $baseQuery): Collection
    {
        $saleQuery = (clone $baseQuery)->where('type', InvoiceType::SALE->value);
        $directRows = (clone $saleQuery)
            ->where(fn ($q) => $q->where('payment_method', '!=', PaymentMethod::SPLIT->value)->orWhereNull('payment_method'))
            ->select('payment_method', DB::raw('COALESCE(SUM(total), 0) as total_amount'), DB::raw('COUNT(*) as count'))
            ->groupBy('payment_method')
            ->get();

        $buckets = [];
        foreach ($directRows as $row) {
            $key = $row->payment_method instanceof PaymentMethod ? $row->payment_method->value : ($row->payment_method ?: PaymentMethod::CASH->value);
            $buckets = $this->addPaymentMethodBucket($buckets, $key, Money::of($row->total_amount ?? 0), (int) $row->count);
        }

        $splitQuery = (clone $saleQuery)->where('payment_method', PaymentMethod::SPLIT->value);
        $buckets = $this->mergeSplitSalesIntoBuckets($buckets, $splitQuery);

        return collect($buckets)->map(fn ($b) => [
            'payment_method' => $b['payment_method'],
            'total_amount' => $b['amount']->getAmount(),
            'count' => $b['count'],
        ])->values();
    }

    private function mergeSplitSalesIntoBuckets(array $buckets, Builder $splitQuery): array
    {
        $splitInvoices = $splitQuery->get(['id', 'total', 'remaining_amount']);
        if ($splitInvoices->isEmpty()) {
            return $buckets;
        }

        $paidByInvoice = Payment::query()
            ->where('type', PaymentType::RECEIPT->value)
            ->whereIn('invoice_id', $splitInvoices->pluck('id')->all())
            ->select('invoice_id', 'method', DB::raw('COALESCE(SUM(amount), 0) as total_amount'))
            ->groupBy('invoice_id', 'method')
            ->get();

        $paidTotalPerInvoice = [];
        $seenChannelPerInvoice = [];
        foreach ($paidByInvoice as $row) {
            $method = $row->method instanceof PaymentMethod ? $row->method->value : (string) $row->method;
            $amt = Money::of($row->total_amount ?? 0);
            $countInc = empty($seenChannelPerInvoice[$row->invoice_id][$method]) ? 1 : 0;
            $seenChannelPerInvoice[$row->invoice_id][$method] = true;
            $paidTotalPerInvoice[$row->invoice_id] = ($paidTotalPerInvoice[$row->invoice_id] ?? Money::zero())->add($amt);
            $buckets = $this->addPaymentMethodBucket($buckets, $method, $amt, $countInc);
        }

        return $this->mergeSplitRemainders($buckets, $splitInvoices, $paidTotalPerInvoice);
    }

    private function mergeSplitRemainders(array $buckets, Collection $splitInvoices, array $paidTotalPerInvoice): array
    {
        foreach ($splitInvoices as $inv) {
            $paid = $paidTotalPerInvoice[$inv->id] ?? Money::zero();
            $rem = Money::of($inv->remaining_amount ?? 0);
            if ($rem->isPositive()) {
                $buckets = $this->addPaymentMethodBucket($buckets, PaymentMethod::CREDIT->value, $rem, 1);
            }
            $uncovered = Money::of($inv->total ?? 0)->subtract($paid)->subtract($rem);
            if ($uncovered->isPositive()) {
                $buckets = $this->addPaymentMethodBucket($buckets, PaymentMethod::SPLIT->value, $uncovered, 1);
            }
        }

        return $buckets;
    }

    private function addPaymentMethodBucket(array $buckets, string $method, Money $amount, int $count): array
    {
        if (!isset($buckets[$method])) {
            $buckets[$method] = ['payment_method' => $method, 'amount' => Money::zero(), 'count' => 0];
        }
        $buckets[$method]['amount'] = $buckets[$method]['amount']->add($amount);
        $buckets[$method]['count'] += $count;

        return $buckets;
    }

    /**
     * تقرير تقييم المخزون والنواقص
     */
    public function getStockReport(User $user, ?string $search = null, int $perPage = 50, ?int $page = null, ?int $branchId = null): array
    {
        $effectiveBranchId = app(BranchScopeService::class)->resolveQueryBranchId($user, $branchId);
        $baseQuery = Product::query();
        if ($effectiveBranchId !== null) {
            $branchTotals = DB::table('branch_stocks')
                ->selectRaw('product_id, COALESCE(SUM(quantity), 0) as branch_qty')
                ->where('branch_id', $effectiveBranchId)
                ->groupBy('product_id');
            $baseQuery->leftJoinSub($branchTotals, 'bs', 'bs.product_id', '=', 'products.id');
        }
        $qtyExpr = $effectiveBranchId !== null ? 'COALESCE(bs.branch_qty, 0)' : 'products.quantity';

        $rawSummary = $this->fetchStockReportRawSummary(clone $baseQuery, $qtyExpr);
        $actualPerPage = min(max(1, $perPage), (int) config('pos.pagination.max', 100));
        $paginator = $this->buildStockListQuery(clone $baseQuery, $search, $qtyExpr)->paginate($actualPerPage, ['*'], 'page', $page);
        $stockList = array_map(fn ($product) => $this->formatStockReportRow($product, $user), $paginator->items());
        $pageMeta = ['current_page' => $paginator->currentPage(), 'last_page' => $paginator->lastPage(), 'per_page' => $paginator->perPage(), 'total' => $paginator->total()];

        return [
            'summary' => $this->formatStockReportSummary($rawSummary, $user),
            'products' => $stockList,
            'pagination' => $pageMeta,
            'meta' => $pageMeta,
        ];
    }

    private function fetchStockReportRawSummary($query, string $qtyExpr = 'products.quantity'): ?object
    {
        return $query->selectRaw("
            COUNT(*) as products_count,
            COALESCE(SUM({$qtyExpr}), 0) as total_quantity,
            COALESCE(SUM(({$qtyExpr}) * products.purchase_price), 0) as total_cost_value,
            COALESCE(SUM(({$qtyExpr}) * products.sale_price), 0) as total_retail_value,
            COALESCE(SUM(CASE WHEN products.min_quantity IS NOT NULL AND ({$qtyExpr}) <= products.min_quantity THEN 1 ELSE 0 END), 0) as low_stock_count
        ")->first();
    }

    private function buildStockListQuery($query, ?string $search, string $qtyExpr = 'products.quantity')
    {
        $listQuery = $query->with('category:id,name')
            ->select([
                'products.id', 'products.category_id', 'products.name', 'products.code', 'products.barcode',
                DB::raw("{$qtyExpr} as quantity"), 'products.unit', 'products.purchase_price', 'products.sale_price', 'products.min_quantity',
            ])
            ->orderBy('products.name');

        if (!empty($search)) {
            $trimmed = trim($search);
            $listQuery->where(function ($q) use ($trimmed) {
                $q->where('products.name', 'like', "%{$trimmed}%")->orWhere('products.code', 'like', "%{$trimmed}%")->orWhere('products.barcode', 'like', "%{$trimmed}%");
            });
        }

        return $listQuery;
    }

    private function formatStockReportRow($product, User $user): array
    {
        $qty = Quantity::of($product->quantity ?? 0)->toFloat();
        $purchaseMoney = Money::of($product->purchase_price ?? 0);
        $saleMoney = Money::of($product->sale_price ?? 0);
        $minQty = $product->min_quantity !== null ? Quantity::of($product->min_quantity)->toFloat() : null;

        return [
            'id' => $product->id, 'name' => $product->name, 'code' => $product->code, 'barcode' => $product->barcode,
            'category' => $product->category?->name, 'quantity' => $qty, 'unit' => $product->unit,
            'purchase_price' => $user->isMandob() ? null : $purchaseMoney->getAmount(),
            'sale_price' => $saleMoney->getAmount(),
            'cost_value' => $user->isMandob() ? null : $purchaseMoney->multiply($qty)->getAmount(),
            'retail_value' => $saleMoney->multiply($qty)->getAmount(),
            'min_quantity' => $minQty, 'is_low_stock' => $minQty !== null && $qty <= $minQty,
        ];
    }

    private function formatStockReportSummary(?object $rawSummary, User $user): array
    {
        $totalCost = Money::of($rawSummary->total_cost_value ?? 0);
        $totalRetail = Money::of($rawSummary->total_retail_value ?? 0);

        return [
            'products_count' => (int) ($rawSummary->products_count ?? 0),
            'total_quantity' => Quantity::of($rawSummary->total_quantity ?? 0)->toFloat(),
            'total_cost_value' => $user->isMandob() ? null : $totalCost->getAmount(),
            'total_retail_value' => $totalRetail->getAmount(),
            'expected_gross_margin' => $user->isMandob() ? null : $totalRetail->subtract($totalCost)->getAmount(),
            'low_stock_count' => (int) ($rawSummary->low_stock_count ?? 0),
        ];
    }

    /**
     * تقرير الخزن الثلاث ومتابعة السيولة وحركات النقدية
     */
    public function getCashFlowReport(?string $fromDate = null, ?string $toDate = null, ?User $user = null, ?int $branchId = null): array
    {
        $effectiveBranchId = $user ? app(BranchScopeService::class)->resolveQueryBranchId($user, $branchId) : $branchId;
        $cash = $this->calculateTreasury(PaymentMethod::CASH->value, true, $fromDate, $toDate, $effectiveBranchId);
        $card = $this->calculateTreasury(PaymentMethod::CARD->value, false, $fromDate, $toDate, $effectiveBranchId);
        $instapay = $this->calculateTreasury(PaymentMethod::INSTAPAY->value, false, $fromDate, $toDate, $effectiveBranchId);
        $vodafone = $this->calculateTreasury(PaymentMethod::VODAFONE_CASH->value, false, $fromDate, $toDate, $effectiveBranchId);
        $transfer = $this->calculateTreasury(PaymentMethod::TRANSFER->value, false, $fromDate, $toDate, $effectiveBranchId);

        $totalFunds = Money::of($cash['net_balance'])->add($card['net_balance'])->add($instapay['net_balance'])->add($vodafone['net_balance'])->add($transfer['net_balance'])->getAmount();

        return [
            'period' => ['from_date' => $fromDate, 'to_date' => $toDate],
            'inflow' => ['cash_sales' => $cash['inflow']['sales'], 'receipt_vouchers' => $cash['inflow']['receipt_vouchers'], 'purchase_returns' => $cash['inflow']['purchase_returns'], 'total_inflow' => $cash['inflow']['total']],
            'outflow' => ['cash_purchases' => $cash['outflow']['purchases'], 'payment_vouchers' => $cash['outflow']['payment_vouchers'], 'sale_returns' => $cash['outflow']['sale_returns'], 'expenses' => $cash['outflow']['expenses'], 'total_outflow' => $cash['outflow']['total']],
            'net_cash_flow' => $cash['net_balance'],
            'treasuries' => $this->formatCashFlowTreasuries($cash, $card, $instapay, $vodafone, $transfer),
            'total_funds' => $totalFunds,
        ];
    }

    private function formatCashFlowTreasuries(array $cash, array $card, array $instapay, array $vodafone, array $transfer): array
    {
        return [
            'cash' => ['name' => 'خزينة الكاش (النقدية)', 'code' => PaymentMethod::CASH->value, 'icon' => 'cash-outline', ...$cash],
            'card' => ['name' => 'خزينة البطاقة (فيزا / شبكة)', 'code' => PaymentMethod::CARD->value, 'icon' => 'card-outline', ...$card],
            'instapay' => ['name' => 'إنستاباي (InstaPay)', 'code' => PaymentMethod::INSTAPAY->value, 'icon' => 'swap-horizontal-outline', ...$instapay],
            'vodafone_cash' => ['name' => 'فودافون كاش والمحافظ', 'code' => PaymentMethod::VODAFONE_CASH->value, 'icon' => 'phone-portrait-outline', ...$vodafone],
            'transfer' => ['name' => 'التحويلات البنكية (أخرى)', 'code' => PaymentMethod::TRANSFER->value, 'icon' => 'business-outline', ...$transfer],
        ];
    }

    /**
     * احتساب رصيد وتدفقات خزينة محددة
     */
    protected function calculateTreasury(string $method, bool $includeExpenses, ?string $fromDate, ?string $toDate, ?int $branchId = null): array
    {
        $invQ = fn (string $type) => Invoice::where('type', $type)->where('payment_method', $method)->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId));
        $payQ = fn (string $type) => $this->applyCashFlowRelationBranch(Payment::where('type', $type)->where('method', $method), $branchId);
        $expQ = $this->applyCashFlowRelationBranch(Expense::query(), $branchId);

        $sales = Money::of($this->applyDateBounds($invQ(InvoiceType::SALE->value), $fromDate, $toDate)->sum('paid_amount') ?? 0)
            ->add(Money::of($this->applyDateBounds($payQ(PaymentType::RECEIPT->value)->whereHas('invoice', fn($q) => $q->where('payment_method', PaymentMethod::SPLIT->value)), $fromDate, $toDate)->sum('amount') ?? 0));
        $receipts = Money::of($this->applyDateBounds($payQ(PaymentType::RECEIPT->value)->whereNull('invoice_id'), $fromDate, $toDate)->sum('amount') ?? 0);
        $purchaseReturns = Money::of($this->applyDateBounds($invQ(InvoiceType::PURCHASE_RETURN->value), $fromDate, $toDate)->sum('paid_amount') ?? 0);
        $totalInflow = $sales->add($receipts)->add($purchaseReturns);

        $purchases = Money::of($this->applyDateBounds($invQ(InvoiceType::PURCHASE->value), $fromDate, $toDate)->sum('paid_amount') ?? 0);
        $payments = Money::of($this->applyDateBounds($payQ(PaymentType::PAYMENT->value)->whereNull('invoice_id'), $fromDate, $toDate)->sum('amount') ?? 0);
        $saleReturns = Money::of($this->applyDateBounds($invQ(InvoiceType::SALE_RETURN->value), $fromDate, $toDate)->sum('paid_amount') ?? 0);
        $expenses = $includeExpenses ? Money::of($this->applyDateBounds($expQ, $fromDate, $toDate)->sum('amount') ?? 0) : Money::zero();
        $totalOutflow = $purchases->add($payments)->add($saleReturns)->add($expenses);

        return [
            'inflow' => ['sales' => $sales->getAmount(), 'receipt_vouchers' => $receipts->getAmount(), 'purchase_returns' => $purchaseReturns->getAmount(), 'total' => $totalInflow->getAmount()],
            'outflow' => ['purchases' => $purchases->getAmount(), 'payment_vouchers' => $payments->getAmount(), 'sale_returns' => $saleReturns->getAmount(), 'expenses' => $expenses->getAmount(), 'total' => $totalOutflow->getAmount()],
            'net_balance' => $totalInflow->subtract($totalOutflow)->getAmount(),
        ];
    }

    private function applyCashFlowRelationBranch($query, ?int $branchId)
    {
        return $branchId === null ? $query : $query->where(fn ($sub) => $sub
            ->whereHas('treasury', fn ($tq) => $tq->where('branch_id', $branchId))
            ->orWhere(fn ($inner) => $inner->whereHas('treasury', fn ($tq) => $tq->whereNull('branch_id'))->whereHas('creator', fn ($cq) => $cq->where('branch_id', $branchId))));
    }

    private function applyDateBounds($query, ?string $fromDate, ?string $toDate, string $column = 'date')
    {
        return $query->when($fromDate, fn($q) => $q->where($column, '>=', $fromDate))
            ->when($toDate, fn($q) => $q->where($column, '<=', $toDate . ' 23:59:59'));
    }

    /**
     * استعلام حركات الخزينة / قناة الدفع التفصيلية مع التصفح والفلترة
     */
    public function getCashFlowTransactions(string $channel, array $filters = [], ?User $user = null): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $fromDate = $filters['from_date'] ?? null;
        $toDate = $filters['to_date'] ?? null;
        $flowType = strtoupper($filters['flow_type'] ?? 'ALL');
        $movementCategory = !empty($filters['movement_category']) ? strtoupper($filters['movement_category']) : null;
        $perPage = min((int) ($filters['per_page'] ?? 15), 50);
        $page = (int) ($filters['page'] ?? 1);
        $branchId = $user ? app(BranchScopeService::class)->resolveQueryBranchId($user, !empty($filters['branch_id']) ? (int) $filters['branch_id'] : null) : null;

        $flags = $this->resolveCashFlowSourceFlags($channel, $flowType, $movementCategory);
        $queries = $this->collectCashFlowUnionQueries($channel, $flowType, $movementCategory, $fromDate, $toDate, $flags, $branchId);

        if (empty($queries)) {
            return new \Illuminate\Pagination\LengthAwarePaginator([], 0, $perPage, $page);
        }

        $baseQuery = array_shift($queries);
        foreach ($queries as $q) {
            $baseQuery->unionAll($q);
        }

        $outerQuery = DB::query()->fromSub($baseQuery, 'cash_flow_tx');
        $this->applyCashFlowOuterFilters($outerQuery, !empty($filters['search']) ? trim($filters['search']) : null, !empty($filters['cashier_id']) ? (int) $filters['cashier_id'] : null);

        return $outerQuery->orderBy('date', 'desc')->orderBy('created_at', 'desc')->paginate($perPage, ['*'], 'page', $page);
    }

    private function resolveCashFlowSourceFlags(string $channel, string $flowType, ?string $movementCategory): array
    {
        if (!$movementCategory) {
            return ['invoices' => true, 'payments' => true, 'expenses' => ($channel === PaymentMethod::CASH->value && $flowType !== 'INFLOW')];
        }

        $invoiceCategories = [InvoiceType::SALE->value, InvoiceType::PURCHASE->value, InvoiceType::SALE_RETURN->value, InvoiceType::PURCHASE_RETURN->value];

        return [
            'invoices' => in_array($movementCategory, $invoiceCategories, true),
            'payments' => in_array($movementCategory, ['RECEIPT_VOUCHER', 'PAYMENT_VOUCHER', 'SPLIT_SALE'], true),
            'expenses' => ($movementCategory === 'EXPENSE' && $channel === PaymentMethod::CASH->value && $flowType !== 'INFLOW'),
        ];
    }

    private function collectCashFlowUnionQueries(string $channel, string $flowType, ?string $movementCategory, ?string $fromDate, ?string $toDate, array $flags, ?int $branchId = null): array
    {
        $queries = [];
        if ($flags['invoices']) {
            $queries[] = $this->buildCashFlowInvoicesQuery($channel, $flowType, $movementCategory, $fromDate, $toDate, $branchId);
        }
        if ($flags['payments']) {
            $queries[] = $this->buildCashFlowPaymentsQuery($channel, $flowType, $movementCategory, $fromDate, $toDate, $branchId);
        }
        if ($flags['expenses']) {
            $queries[] = $this->buildCashFlowExpensesQuery($channel, $fromDate, $toDate, $branchId);
        }

        return $queries;
    }

    private function buildCashFlowInvoicesQuery(string $channel, string $flowType, ?string $movementCategory, ?string $fromDate, ?string $toDate, ?int $branchId = null)
    {
        $invoiceTypes = [InvoiceType::SALE->value, InvoiceType::PURCHASE->value, InvoiceType::SALE_RETURN->value, InvoiceType::PURCHASE_RETURN->value];
        $query = Invoice::query()
            ->selectRaw("invoices.id, 'INVOICE' as source_type, invoices.type as movement_category, invoices.invoice_number as reference_number, invoices.date, invoices.created_at, invoices.paid_amount as amount, case when invoices.type in ('SALE', 'PURCHASE_RETURN') then 'IN' else 'OUT' end as flow_direction, invoices.party_id, parties.name as party_name, invoices.created_by, users.name as creator_name, invoices.notes")
            ->leftJoin('parties', 'invoices.party_id', '=', 'parties.id')->leftJoin('users', 'invoices.created_by', '=', 'users.id')
            ->where('invoices.payment_method', $channel)->where('invoices.paid_amount', '>', 0)
            ->when($branchId !== null, fn ($q) => $q->where('invoices.branch_id', $branchId));

        if ($movementCategory && in_array($movementCategory, $invoiceTypes, true)) {
            $query->where('invoices.type', $movementCategory);
        } elseif ($flowType === 'INFLOW') {
            $query->whereIn('invoices.type', [InvoiceType::SALE->value, InvoiceType::PURCHASE_RETURN->value]);
        } elseif ($flowType === 'OUTFLOW') {
            $query->whereIn('invoices.type', [InvoiceType::PURCHASE->value, InvoiceType::SALE_RETURN->value]);
        } else {
            $query->whereIn('invoices.type', $invoiceTypes);
        }

        $this->applyDateRangeFilter($query, 'invoices.date', $fromDate, $toDate);

        return $query;
    }

    private function buildCashFlowPaymentsQuery(string $channel, string $flowType, ?string $movementCategory, ?string $fromDate, ?string $toDate, ?int $branchId = null)
    {
        $query = Payment::query()
            ->selectRaw("payments.id, 'PAYMENT' as source_type, case when payments.invoice_id is not null then 'SPLIT_SALE' when payments.type = 'RECEIPT' then 'RECEIPT_VOUCHER' else 'PAYMENT_VOUCHER' end as movement_category, payments.id as reference_number, payments.date, payments.created_at, payments.amount, case when payments.type = 'RECEIPT' then 'IN' else 'OUT' end as flow_direction, payments.party_id, parties.name as party_name, payments.created_by, users.name as creator_name, payments.notes")
            ->leftJoin('parties', 'payments.party_id', '=', 'parties.id')->leftJoin('users', 'payments.created_by', '=', 'users.id')
            ->where('payments.method', $channel)
            ->where(fn ($q) => $q->whereNull('payments.invoice_id')->orWhereHas('invoice', fn ($iq) => $iq->where('payment_method', PaymentMethod::SPLIT->value)));

        $this->applyCashFlowRelationBranch($query, $branchId);
        $this->applyCashFlowPaymentCategoryFilter($query, $flowType, $movementCategory);
        $this->applyDateRangeFilter($query, 'payments.date', $fromDate, $toDate);

        return $query;
    }

    private function applyCashFlowPaymentCategoryFilter($paymentQuery, string $flowType, ?string $movementCategory): void
    {
        if ($movementCategory === 'SPLIT_SALE') {
            $paymentQuery->whereNotNull('payments.invoice_id')->whereHas('invoice', fn ($iq) => $iq->where('payment_method', PaymentMethod::SPLIT->value));
        } elseif ($movementCategory === 'RECEIPT_VOUCHER') {
            $paymentQuery->where('payments.type', PaymentType::RECEIPT->value)->whereNull('payments.invoice_id');
        } elseif ($movementCategory === 'PAYMENT_VOUCHER') {
            $paymentQuery->where('payments.type', PaymentType::PAYMENT->value)->whereNull('payments.invoice_id');
        } elseif ($flowType === 'INFLOW') {
            $paymentQuery->where('payments.type', PaymentType::RECEIPT->value);
        } elseif ($flowType === 'OUTFLOW') {
            $paymentQuery->where('payments.type', PaymentType::PAYMENT->value);
        }
    }

    private function buildCashFlowExpensesQuery(string $channel, ?string $fromDate, ?string $toDate, ?int $branchId = null)
    {
        $query = Expense::query()
            ->selectRaw("expenses.id, 'EXPENSE' as source_type, 'EXPENSE' as movement_category, expenses.title as reference_number, expenses.date, expenses.created_at, expenses.amount, 'OUT' as flow_direction, null as party_id, expenses.category as party_name, expenses.created_by, users.name as creator_name, expenses.notes")
            ->leftJoin('users', 'expenses.created_by', '=', 'users.id');

        $this->applyCashFlowRelationBranch($query, $branchId);
        if ($channel === PaymentMethod::CASH->value) {
            $query->where(fn ($q) => $q->whereNull('expenses.payment_method')->orWhere('expenses.payment_method', PaymentMethod::CASH->value));
        } else {
            $query->where('expenses.payment_method', $channel);
        }

        $this->applyDateRangeFilter($query, 'expenses.date', $fromDate, $toDate);

        return $query;
    }

    private function applyDateRangeFilter($query, string $column, ?string $fromDate, ?string $toDate): void
    {
        if ($fromDate) {
            $query->where($column, '>=', $fromDate);
        }
        if ($toDate) {
            $query->where($column, '<=', $toDate . ' 23:59:59');
        }
    }

    private function applyCashFlowOuterFilters($outerQuery, ?string $search, ?int $cashierId): void
    {
        if ($search) {
            $outerQuery->where(fn ($q) => $q->where('reference_number', 'like', "%{$search}%")->orWhere('party_name', 'like', "%{$search}%")->orWhere('creator_name', 'like', "%{$search}%")->orWhere('notes', 'like', "%{$search}%"));
        }
        if ($cashierId) {
            $outerQuery->where('created_by', $cashierId);
        }
    }
}
