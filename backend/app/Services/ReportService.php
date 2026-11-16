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
use Illuminate\Support\Facades\DB;

class ReportService
{
    /**
     * تقرير الأرباح الشامل (المبيعات، تكلفة البضاعة المباعة COGS، المصروفات، وصافي الأرباح)
     */
    public function getProfitReport(?string $fromDate = null, ?string $toDate = null): array
    {
        $salesQuery = $this->applyDateBounds(Invoice::where('type', InvoiceType::SALE->value), $fromDate, $toDate);
        $returnsQuery = $this->applyDateBounds(Invoice::where('type', InvoiceType::SALE_RETURN->value), $fromDate, $toDate);
        $expensesQuery = $this->applyDateBounds(Expense::query(), $fromDate, $toDate);

        $grossSales = Money::of($salesQuery->sum('total') ?? 0);
        $saleReturns = Money::of($returnsQuery->sum('total') ?? 0);
        $netSales = $grossSales->subtract($saleReturns);
        $cogsSales = $this->calculateCogs(InvoiceType::SALE->value, $fromDate, $toDate);
        $cogsReturns = $this->calculateCogs(InvoiceType::SALE_RETURN->value, $fromDate, $toDate);
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
    protected function calculateCogs(string $invoiceType, ?string $fromDate, ?string $toDate): Money
    {
        $rawSum = InvoiceItem::whereHas('invoice', function ($q) use ($invoiceType, $fromDate, $toDate) {
            $q->where('type', $invoiceType)
              ->when($fromDate, fn($iq) => $iq->where('date', '>=', $fromDate))
              ->when($toDate, fn($iq) => $iq->where('date', '<=', $toDate . ' 23:59:59'));
        })->sum(DB::raw('quantity * purchase_price_at_sale'));

        return Money::of($rawSum ?? 0);
    }

    /**
     * ملخص المبيعات وطرق الدفع
     */
    public function getSalesReport(User $user, ?string $fromDate = null, ?string $toDate = null): array
    {
        $query = $this->applyDateBounds(Invoice::query()->when($user->isMandob(), fn($q) => $q->where('created_by', $user->id)), $fromDate, $toDate);
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
            'payment_methods' => (clone $query)->where('type', InvoiceType::SALE->value)->select('payment_method', DB::raw('COALESCE(SUM(total), 0) as total_amount'), DB::raw('COUNT(*) as count'))->groupBy('payment_method')->get(),
        ];
    }

    /**
     * تقرير تقييم المخزون والنواقص
     */
    public function getStockReport(User $user, ?string $search = null, int $perPage = 50): array
    {
        $baseQuery = Product::query();

        // إجماليات التقييم عبر SQL aggregates
        $rawSummary = (clone $baseQuery)->selectRaw('
            COUNT(*) as products_count,
            COALESCE(SUM(quantity), 0) as total_quantity,
            COALESCE(SUM(quantity * purchase_price), 0) as total_cost_value,
            COALESCE(SUM(quantity * sale_price), 0) as total_retail_value,
            COALESCE(SUM(CASE WHEN min_quantity IS NOT NULL AND quantity <= min_quantity THEN 1 ELSE 0 END), 0) as low_stock_count
        ')->first();

        $totalCost = Money::of($rawSummary->total_cost_value ?? 0);
        $totalRetail = Money::of($rawSummary->total_retail_value ?? 0);
        $grossMargin = $totalRetail->subtract($totalCost)->getAmount();

        $maxPerPage = (int) config('pos.pagination.max', 100);
        $actualPerPage = min(max(1, $perPage), $maxPerPage);

        $listQuery = (clone $baseQuery)->with('category:id,name')
            ->select(['id', 'category_id', 'name', 'code', 'barcode', 'quantity', 'unit', 'purchase_price', 'sale_price', 'min_quantity'])
            ->orderBy('name');

        if (!empty($search)) {
            $trimmed = trim($search);
            $listQuery->where(function ($q) use ($trimmed) {
                $q->where('name', 'like', "%{$trimmed}%")
                    ->orWhere('code', 'like', "%{$trimmed}%")
                    ->orWhere('barcode', 'like', "%{$trimmed}%");
            });
        }

        $paginator = $listQuery->paginate($actualPerPage);

        $stockList = [];
        foreach ($paginator->items() as $product) {
            $qty = Quantity::of($product->quantity ?? 0)->toFloat();
            $purchasePriceMoney = Money::of($product->purchase_price ?? 0);
            $salePriceMoney = Money::of($product->sale_price ?? 0);
            $purchasePrice = $user->isMandob() ? null : $purchasePriceMoney->getAmount();
            $salePrice = $salePriceMoney->getAmount();
            $minQty = $product->min_quantity !== null ? Quantity::of($product->min_quantity)->toFloat() : null;

            $costValMoney = $user->isMandob() ? null : $purchasePriceMoney->multiply($qty);
            $retailValMoney = $salePriceMoney->multiply($qty);
            $isLowStock = $minQty !== null && $qty <= $minQty;

            $stockList[] = [
                'id' => $product->id,
                'name' => $product->name,
                'code' => $product->code,
                'barcode' => $product->barcode,
                'category' => $product->category?->name,
                'quantity' => $qty,
                'unit' => $product->unit,
                'purchase_price' => $purchasePrice,
                'sale_price' => $salePrice,
                'cost_value' => $costValMoney?->getAmount(),
                'retail_value' => $retailValMoney->getAmount(),
                'min_quantity' => $minQty,
                'is_low_stock' => $isLowStock,
            ];
        }

        return [
            'summary' => [
                'products_count' => (int) ($rawSummary->products_count ?? 0),
                'total_quantity' => Quantity::of($rawSummary->total_quantity ?? 0)->toFloat(),
                'total_cost_value' => $user->isMandob() ? null : $totalCost->getAmount(),
                'total_retail_value' => $totalRetail->getAmount(),
                'expected_gross_margin' => $user->isMandob() ? null : $grossMargin,
                'low_stock_count' => (int) ($rawSummary->low_stock_count ?? 0),
            ],
            'products' => $stockList,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ];
    }

    /**
     * تقرير الخزن الثلاث ومتابعة السيولة وحركات النقدية
     */
    public function getCashFlowReport(?string $fromDate = null, ?string $toDate = null): array
    {
        $cash = $this->calculateTreasury(PaymentMethod::CASH->value, true, $fromDate, $toDate);
        $card = $this->calculateTreasury(PaymentMethod::CARD->value, false, $fromDate, $toDate);
        $instapay = $this->calculateTreasury(PaymentMethod::INSTAPAY->value, false, $fromDate, $toDate);
        $vodafone = $this->calculateTreasury(PaymentMethod::VODAFONE_CASH->value, false, $fromDate, $toDate);
        $transfer = $this->calculateTreasury(PaymentMethod::TRANSFER->value, false, $fromDate, $toDate);

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
    protected function calculateTreasury(string $method, bool $includeExpenses, ?string $fromDate, ?string $toDate): array
    {
        $sales = Money::of($this->applyDateBounds(Invoice::where('type', InvoiceType::SALE->value)->where('payment_method', $method), $fromDate, $toDate)->sum('paid_amount') ?? 0)
            ->add(Money::of($this->applyDateBounds(Payment::where('type', PaymentType::RECEIPT->value)->where('method', $method)->whereHas('invoice', fn($q) => $q->where('payment_method', PaymentMethod::SPLIT->value)), $fromDate, $toDate)->sum('amount') ?? 0));
        $receipts = Money::of($this->applyDateBounds(Payment::where('type', PaymentType::RECEIPT->value)->where('method', $method)->whereNull('invoice_id'), $fromDate, $toDate)->sum('amount') ?? 0);
        $purchaseReturns = Money::of($this->applyDateBounds(Invoice::where('type', InvoiceType::PURCHASE_RETURN->value)->where('payment_method', $method), $fromDate, $toDate)->sum('paid_amount') ?? 0);
        $totalInflow = $sales->add($receipts)->add($purchaseReturns);

        $purchases = Money::of($this->applyDateBounds(Invoice::where('type', InvoiceType::PURCHASE->value)->where('payment_method', $method), $fromDate, $toDate)->sum('paid_amount') ?? 0);
        $payments = Money::of($this->applyDateBounds(Payment::where('type', PaymentType::PAYMENT->value)->where('method', $method)->whereNull('invoice_id'), $fromDate, $toDate)->sum('amount') ?? 0);
        $saleReturns = Money::of($this->applyDateBounds(Invoice::where('type', InvoiceType::SALE_RETURN->value)->where('payment_method', $method), $fromDate, $toDate)->sum('paid_amount') ?? 0);
        $expenses = $includeExpenses ? Money::of($this->applyDateBounds(Expense::query(), $fromDate, $toDate)->sum('amount') ?? 0) : Money::zero();
        $totalOutflow = $purchases->add($payments)->add($saleReturns)->add($expenses);

        return [
            'inflow' => ['sales' => $sales->getAmount(), 'receipt_vouchers' => $receipts->getAmount(), 'purchase_returns' => $purchaseReturns->getAmount(), 'total' => $totalInflow->getAmount()],
            'outflow' => ['purchases' => $purchases->getAmount(), 'payment_vouchers' => $payments->getAmount(), 'sale_returns' => $saleReturns->getAmount(), 'expenses' => $expenses->getAmount(), 'total' => $totalOutflow->getAmount()],
            'net_balance' => $totalInflow->subtract($totalOutflow)->getAmount(),
        ];
    }

    private function applyDateBounds($query, ?string $fromDate, ?string $toDate, string $column = 'date')
    {
        return $query->when($fromDate, fn($q) => $q->where($column, '>=', $fromDate))
            ->when($toDate, fn($q) => $q->where($column, '<=', $toDate . ' 23:59:59'));
    }

    /**
     * استعلام حركات الخزينة / قناة الدفع التفصيلية مع التصفح والفلترة
     */
    public function getCashFlowTransactions(string $channel, array $filters = []): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $fromDate = $filters['from_date'] ?? null;
        $toDate = $filters['to_date'] ?? null;
        $flowType = strtoupper($filters['flow_type'] ?? 'ALL'); // ALL, INFLOW, OUTFLOW
        $movementCategory = !empty($filters['movement_category']) ? strtoupper($filters['movement_category']) : null;
        $search = !empty($filters['search']) ? trim($filters['search']) : null;
        $cashierId = !empty($filters['cashier_id']) ? (int) $filters['cashier_id'] : null;
        $perPage = min((int) ($filters['per_page'] ?? 15), 50);
        $page = (int) ($filters['page'] ?? 1);

        $shouldIncludeInvoices = true;
        $shouldIncludePayments = true;
        $shouldIncludeExpenses = ($channel === PaymentMethod::CASH->value);

        if ($flowType === 'INFLOW') {
            $shouldIncludeExpenses = false;
        }

        if ($movementCategory) {
            $invoiceCategories = [InvoiceType::SALE->value, InvoiceType::PURCHASE->value, InvoiceType::SALE_RETURN->value, InvoiceType::PURCHASE_RETURN->value];
            $paymentCategories = ['RECEIPT_VOUCHER', 'PAYMENT_VOUCHER', 'SPLIT_SALE'];

            $shouldIncludeInvoices = in_array($movementCategory, $invoiceCategories, true);
            $shouldIncludePayments = in_array($movementCategory, $paymentCategories, true);
            $shouldIncludeExpenses = ($movementCategory === 'EXPENSE' && $channel === PaymentMethod::CASH->value);
        }

        $queries = [];

        // 1. Invoices Query
        if ($shouldIncludeInvoices) {
            $invoiceQuery = Invoice::query()
                ->selectRaw("
                    invoices.id,
                    'INVOICE' as source_type,
                    invoices.type as movement_category,
                    invoices.invoice_number as reference_number,
                    invoices.date,
                    invoices.created_at,
                    invoices.paid_amount as amount,
                    case when invoices.type in ('SALE', 'PURCHASE_RETURN') then 'IN' else 'OUT' end as flow_direction,
                    invoices.party_id,
                    parties.name as party_name,
                    invoices.created_by,
                    users.name as creator_name,
                    invoices.notes
                ")
                ->leftJoin('parties', 'invoices.party_id', '=', 'parties.id')
                ->leftJoin('users', 'invoices.created_by', '=', 'users.id')
                ->where('invoices.payment_method', $channel)
                ->where('invoices.paid_amount', '>', 0);

            if ($movementCategory && in_array($movementCategory, [InvoiceType::SALE->value, InvoiceType::PURCHASE->value, InvoiceType::SALE_RETURN->value, InvoiceType::PURCHASE_RETURN->value], true)) {
                $invoiceQuery->where('invoices.type', $movementCategory);
            } else {
                $invoiceQuery->whereIn('invoices.type', [InvoiceType::SALE->value, InvoiceType::PURCHASE->value, InvoiceType::SALE_RETURN->value, InvoiceType::PURCHASE_RETURN->value]);
                if ($flowType === 'INFLOW') {
                    $invoiceQuery->whereIn('invoices.type', [InvoiceType::SALE->value, InvoiceType::PURCHASE_RETURN->value]);
                } elseif ($flowType === 'OUTFLOW') {
                    $invoiceQuery->whereIn('invoices.type', [InvoiceType::PURCHASE->value, InvoiceType::SALE_RETURN->value]);
                }
            }

            if ($fromDate) {
                $invoiceQuery->where('invoices.date', '>=', $fromDate);
            }
            if ($toDate) {
                $invoiceQuery->where('invoices.date', '<=', $toDate . ' 23:59:59');
            }

            $queries[] = $invoiceQuery;
        }

        // 2. Payments Query
        if ($shouldIncludePayments) {
            $paymentQuery = Payment::query()
                ->selectRaw("
                    payments.id,
                    'PAYMENT' as source_type,
                    case 
                        when payments.invoice_id is not null then 'SPLIT_SALE'
                        when payments.type = 'RECEIPT' then 'RECEIPT_VOUCHER'
                        else 'PAYMENT_VOUCHER'
                    end as movement_category,
                    payments.id as reference_number,
                    payments.date,
                    payments.created_at,
                    payments.amount,
                    case when payments.type = 'RECEIPT' then 'IN' else 'OUT' end as flow_direction,
                    payments.party_id,
                    parties.name as party_name,
                    payments.created_by,
                    users.name as creator_name,
                    payments.notes
                ")
                ->leftJoin('parties', 'payments.party_id', '=', 'parties.id')
                ->leftJoin('users', 'payments.created_by', '=', 'users.id')
                ->where('payments.method', $channel)
                ->where(function ($q) {
                    $q->whereNull('payments.invoice_id')
                      ->orWhereHas('invoice', fn($iq) => $iq->where('payment_method', PaymentMethod::SPLIT->value));
                });

            if ($movementCategory === 'SPLIT_SALE') {
                $paymentQuery->whereNotNull('payments.invoice_id')
                    ->whereHas('invoice', fn($iq) => $iq->where('payment_method', PaymentMethod::SPLIT->value));
            } elseif ($movementCategory === 'RECEIPT_VOUCHER') {
                $paymentQuery->where('payments.type', PaymentType::RECEIPT->value)->whereNull('payments.invoice_id');
            } elseif ($movementCategory === 'PAYMENT_VOUCHER') {
                $paymentQuery->where('payments.type', PaymentType::PAYMENT->value)->whereNull('payments.invoice_id');
            } else {
                if ($flowType === 'INFLOW') {
                    $paymentQuery->where('payments.type', PaymentType::RECEIPT->value);
                } elseif ($flowType === 'OUTFLOW') {
                    $paymentQuery->where('payments.type', PaymentType::PAYMENT->value);
                }
            }

            if ($fromDate) {
                $paymentQuery->where('payments.date', '>=', $fromDate);
            }
            if ($toDate) {
                $paymentQuery->where('payments.date', '<=', $toDate . ' 23:59:59');
            }

            $queries[] = $paymentQuery;
        }

        // 3. Expenses Query
        if ($shouldIncludeExpenses) {
            $expenseQuery = Expense::query()
                ->selectRaw("
                    expenses.id,
                    'EXPENSE' as source_type,
                    'EXPENSE' as movement_category,
                    expenses.title as reference_number,
                    expenses.date,
                    expenses.created_at,
                    expenses.amount,
                    'OUT' as flow_direction,
                    null as party_id,
                    expenses.category as party_name,
                    expenses.created_by,
                    users.name as creator_name,
                    expenses.notes
                ")
                ->leftJoin('users', 'expenses.created_by', '=', 'users.id');

            if ($channel === PaymentMethod::CASH->value) {
                $expenseQuery->where(function ($q) {
                    $q->whereNull('expenses.payment_method')
                      ->orWhere('expenses.payment_method', PaymentMethod::CASH->value);
                });
            } else {
                $expenseQuery->where('expenses.payment_method', $channel);
            }

            if ($fromDate) {
                $expenseQuery->where('expenses.date', '>=', $fromDate);
            }
            if ($toDate) {
                $expenseQuery->where('expenses.date', '<=', $toDate . ' 23:59:59');
            }

            $queries[] = $expenseQuery;
        }

        if (empty($queries)) {
            return new \Illuminate\Pagination\LengthAwarePaginator([], 0, $perPage, $page);
        }

        $baseQuery = array_shift($queries);
        foreach ($queries as $q) {
            $baseQuery->unionAll($q);
        }

        $outerQuery = DB::query()->fromSub($baseQuery, 'cash_flow_tx');

        if ($search) {
            $outerQuery->where(function ($q) use ($search) {
                $q->where('reference_number', 'like', "%{$search}%")
                  ->orWhere('party_name', 'like', "%{$search}%")
                  ->orWhere('creator_name', 'like', "%{$search}%")
                  ->orWhere('notes', 'like', "%{$search}%");
            });
        }

        if ($cashierId) {
            $outerQuery->where('created_by', $cashierId);
        }

        return $outerQuery
            ->orderBy('date', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);
    }
}
