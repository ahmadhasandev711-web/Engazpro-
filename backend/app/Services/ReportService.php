<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

class ReportService
{
    /**
     * تقرير الأرباح الشامل (المبيعات، تكلفة البضاعة المباعة COGS، المصروفات، وصافي الأرباح)
     */
    public function getProfitReport(?string $fromDate = null, ?string $toDate = null): array
    {
        // 1. استعلامات المبيعات ومرتجعاتها
        $salesQuery = Invoice::where('type', 'SALE')
            ->when($fromDate, fn($q) => $q->where('date', '>=', $fromDate))
            ->when($toDate, fn($q) => $q->where('date', '<=', $toDate . ' 23:59:59'));

        $returnsQuery = Invoice::where('type', 'SALE_RETURN')
            ->when($fromDate, fn($q) => $q->where('date', '>=', $fromDate))
            ->when($toDate, fn($q) => $q->where('date', '<=', $toDate . ' 23:59:59'));

        $grossSales = Money::of($salesQuery->sum('total') ?? 0);
        $saleReturns = Money::of($returnsQuery->sum('total') ?? 0);
        $netSales = $grossSales->subtract($saleReturns);
        $shippingRevenue = Money::of($salesQuery->sum('shipping_amount') ?? 0);
        $productSales = Money::of($salesQuery->sum('subtotal') ?? 0);
        $discounts = Money::of($salesQuery->sum('discount') ?? 0);

        // 2. حساب تكلفة البضاعة المباعة (COGS)
        $cogsSales = $this->calculateCogs('SALE', $fromDate, $toDate);
        $cogsReturns = $this->calculateCogs('SALE_RETURN', $fromDate, $toDate);
        $netCogs = $cogsSales->subtract($cogsReturns);

        // 3. إجمالي وصافي الربح
        $grossProfit = $netSales->subtract($netCogs);

        $expensesQuery = Expense::query()
            ->when($fromDate, fn($q) => $q->where('date', '>=', $fromDate))
            ->when($toDate, fn($q) => $q->where('date', '<=', $toDate . ' 23:59:59'));

        $totalExpenses = Money::of($expensesQuery->sum('amount') ?? 0);
        $netProfit = $grossProfit->subtract($totalExpenses);

        $netSalesAmount = $netSales->getAmount();
        $profitMargin = $netSalesAmount > 0 
            ? round(($netProfit->getAmount() / $netSalesAmount) * 100, 2) 
            : 0;

        return [
            'period' => [
                'from_date' => $fromDate,
                'to_date' => $toDate,
            ],
            'sales' => [
                'gross_sales' => $grossSales->getAmount(),
                'product_sales' => $productSales->getAmount(),
                'shipping_revenue' => $shippingRevenue->getAmount(),
                'discounts' => $discounts->getAmount(),
                'sale_returns' => $saleReturns->getAmount(),
                'net_sales' => $netSales->getAmount(),
                'sales_count' => $salesQuery->count(),
                'returns_count' => $returnsQuery->count(),
            ],
            'cogs' => [
                'cogs_sales' => $cogsSales->getAmount(),
                'cogs_returns' => $cogsReturns->getAmount(),
                'net_cogs' => $netCogs->getAmount(),
            ],
            'profit' => [
                'gross_profit' => $grossProfit->getAmount(),
                'total_expenses' => $totalExpenses->getAmount(),
                'expenses_count' => $expensesQuery->count(),
                'net_profit' => $netProfit->getAmount(),
                'profit_margin' => $profitMargin,
            ],
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
        $query = Invoice::query()
            ->when($user->isMandob(), fn($q) => $q->where('created_by', $user->id))
            ->when($fromDate, fn($q) => $q->where('date', '>=', $fromDate))
            ->when($toDate, fn($q) => $q->where('date', '<=', $toDate . ' 23:59:59'));

        $aggregates = (clone $query)
            ->select(
                'type',
                DB::raw('COALESCE(SUM(total), 0) as total_amount'),
                DB::raw('COALESCE(SUM(shipping_amount), 0) as shipping_amount'),
                DB::raw('COALESCE(SUM(paid_amount), 0) as paid_amount'),
                DB::raw('COALESCE(SUM(remaining_amount), 0) as remaining_amount')
            )
            ->groupBy('type')
            ->get()
            ->keyBy('type');

        $saleRow = $aggregates->get('SALE');
        $purchaseRow = $user->isMandob() ? null : $aggregates->get('PURCHASE');
        $saleReturnRow = $aggregates->get('SALE_RETURN');
        $purchaseReturnRow = $user->isMandob() ? null : $aggregates->get('PURCHASE_RETURN');

        $paymentMethodsBreakdown = (clone $query)
            ->where('type', 'SALE')
            ->select('payment_method', DB::raw('COALESCE(SUM(total), 0) as total_amount'), DB::raw('COUNT(*) as count'))
            ->groupBy('payment_method')
            ->get();

        return [
            'total_sales' => Money::of($saleRow?->total_amount ?? 0)->getAmount(),
            'total_shipping' => Money::of($saleRow?->shipping_amount ?? 0)->getAmount(),
            'total_purchases' => Money::of($purchaseRow?->total_amount ?? 0)->getAmount(),
            'total_sale_returns' => Money::of($saleReturnRow?->total_amount ?? 0)->getAmount(),
            'total_purchase_returns' => Money::of($purchaseReturnRow?->total_amount ?? 0)->getAmount(),
            'sales_paid' => Money::of($saleRow?->paid_amount ?? 0)->getAmount(),
            'sales_remaining' => Money::of($saleRow?->remaining_amount ?? 0)->getAmount(),
            'payment_methods' => $paymentMethodsBreakdown,
        ];
    }

    /**
     * تقرير تقييم المخزون والنواقص
     */
    public function getStockReport(User $user): array
    {
        $products = Product::with('category:id,name')
            ->select(['id', 'category_id', 'name', 'code', 'barcode', 'quantity', 'unit', 'purchase_price', 'sale_price', 'min_quantity'])
            ->orderBy('name')
            ->get();

        $stockList = [];
        $totalCost = Money::zero();
        $totalRetail = Money::zero();
        $totalQuantity = 0;
        $lowStockCount = 0;

        foreach ($products as $product) {
            $qty = $product->quantity + 0;
            $purchasePriceMoney = Money::of($product->purchase_price ?? 0);
            $salePriceMoney = Money::of($product->sale_price ?? 0);
            $purchasePrice = $user->isMandob() ? null : $purchasePriceMoney->getAmount();
            $salePrice = $salePriceMoney->getAmount();
            $minQty = $product->min_quantity !== null ? ($product->min_quantity + 0) : null;

            $costValMoney = $user->isMandob() ? null : $purchasePriceMoney->multiply($qty);
            $retailValMoney = $salePriceMoney->multiply($qty);
            $isLowStock = $minQty !== null && $qty <= $minQty;

            $totalQuantity += $qty;
            if (!$user->isMandob() && $costValMoney) {
                $totalCost = $totalCost->add($costValMoney);
            }
            $totalRetail = $totalRetail->add($retailValMoney);
            if ($isLowStock) {
                $lowStockCount++;
            }

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
                'products_count' => $products->count(),
                'total_quantity' => $totalQuantity,
                'total_cost_value' => $user->isMandob() ? null : $totalCost->getAmount(),
                'total_retail_value' => $totalRetail->getAmount(),
                'expected_gross_margin' => $user->isMandob() ? null : $totalRetail->subtract($totalCost)->getAmount(),
                'low_stock_count' => $lowStockCount,
            ],
            'products' => $stockList,
        ];
    }

    /**
     * تقرير الخزن الثلاث ومتابعة السيولة وحركات النقدية
     */
    public function getCashFlowReport(?string $fromDate = null, ?string $toDate = null): array
    {
        $cashTreasury = $this->calculateTreasury('CASH', true, $fromDate, $toDate);
        $cardTreasury = $this->calculateTreasury('CARD', false, $fromDate, $toDate);
        $instapayTreasury = $this->calculateTreasury('INSTAPAY', false, $fromDate, $toDate);
        $vodafoneTreasury = $this->calculateTreasury('VODAFONE_CASH', false, $fromDate, $toDate);
        $transferTreasury = $this->calculateTreasury('TRANSFER', false, $fromDate, $toDate);

        $totalFunds = Money::of($cashTreasury['net_balance'])
            ->add($cardTreasury['net_balance'])
            ->add($instapayTreasury['net_balance'])
            ->add($vodafoneTreasury['net_balance'])
            ->add($transferTreasury['net_balance'])
            ->getAmount();

        return [
            'period' => [
                'from_date' => $fromDate,
                'to_date' => $toDate,
            ],
            'inflow' => [
                'cash_sales' => $cashTreasury['inflow']['sales'],
                'receipt_vouchers' => $cashTreasury['inflow']['receipt_vouchers'],
                'purchase_returns' => $cashTreasury['inflow']['purchase_returns'],
                'total_inflow' => $cashTreasury['inflow']['total'],
            ],
            'outflow' => [
                'cash_purchases' => $cashTreasury['outflow']['purchases'],
                'payment_vouchers' => $cashTreasury['outflow']['payment_vouchers'],
                'sale_returns' => $cashTreasury['outflow']['sale_returns'],
                'expenses' => $cashTreasury['outflow']['expenses'],
                'total_outflow' => $cashTreasury['outflow']['total'],
            ],
            'net_cash_flow' => $cashTreasury['net_balance'],
            'treasuries' => [
                'cash' => [
                    'name' => 'خزينة الكاش (النقدية)',
                    'code' => 'CASH',
                    'icon' => 'cash-outline',
                    ...$cashTreasury,
                ],
                'card' => [
                    'name' => 'خزينة البطاقة (فيزا / شبكة)',
                    'code' => 'CARD',
                    'icon' => 'card-outline',
                    ...$cardTreasury,
                ],
                'instapay' => [
                    'name' => 'إنستاباي (InstaPay)',
                    'code' => 'INSTAPAY',
                    'icon' => 'swap-horizontal-outline',
                    ...$instapayTreasury,
                ],
                'vodafone_cash' => [
                    'name' => 'فودافون كاش والمحافظ',
                    'code' => 'VODAFONE_CASH',
                    'icon' => 'phone-portrait-outline',
                    ...$vodafoneTreasury,
                ],
                'transfer' => [
                    'name' => 'التحويلات البنكية (أخرى)',
                    'code' => 'TRANSFER',
                    'icon' => 'business-outline',
                    ...$transferTreasury,
                ],
            ],
            'total_funds' => $totalFunds,
        ];
    }

    /**
     * احتساب رصيد وتدفقات خزينة محددة
     */
    protected function calculateTreasury(string $method, bool $includeExpenses, ?string $fromDate, ?string $toDate): array
    {
        $salesQuery = Invoice::where('type', 'SALE')->where('payment_method', $method);
        $splitSalesQuery = Payment::where('type', 'RECEIPT')
            ->where('method', $method)
            ->whereHas('invoice', fn($q) => $q->where('payment_method', 'SPLIT'));
        $receiptsQuery = Payment::where('type', 'RECEIPT')->where('method', $method)->whereNull('invoice_id');
        $purchaseReturnsQuery = Invoice::where('type', 'PURCHASE_RETURN')->where('payment_method', $method);

        $purchasesQuery = Invoice::where('type', 'PURCHASE')->where('payment_method', $method);
        $paymentsQuery = Payment::where('type', 'PAYMENT')->where('method', $method)->whereNull('invoice_id');
        $saleReturnsQuery = Invoice::where('type', 'SALE_RETURN')->where('payment_method', $method);
        $expensesQuery = Expense::query();

        if ($fromDate) {
            $salesQuery->where('date', '>=', $fromDate);
            $splitSalesQuery->where('date', '>=', $fromDate);
            $receiptsQuery->where('date', '>=', $fromDate);
            $purchaseReturnsQuery->where('date', '>=', $fromDate);
            $purchasesQuery->where('date', '>=', $fromDate);
            $paymentsQuery->where('date', '>=', $fromDate);
            $saleReturnsQuery->where('date', '>=', $fromDate);
            $expensesQuery->where('date', '>=', $fromDate);
        }
        if ($toDate) {
            $endBound = $toDate . ' 23:59:59';
            $salesQuery->where('date', '<=', $endBound);
            $splitSalesQuery->where('date', '<=', $endBound);
            $receiptsQuery->where('date', '<=', $endBound);
            $purchaseReturnsQuery->where('date', '<=', $endBound);
            $purchasesQuery->where('date', '<=', $endBound);
            $paymentsQuery->where('date', '<=', $endBound);
            $saleReturnsQuery->where('date', '<=', $endBound);
            $expensesQuery->where('date', '<=', $endBound);
        }

        $directSales = Money::of($salesQuery->sum('paid_amount') ?? 0);
        $splitSales = Money::of($splitSalesQuery->sum('amount') ?? 0);
        $sales = $directSales->add($splitSales);
        $receipts = Money::of($receiptsQuery->sum('amount') ?? 0);
        $purchaseReturns = Money::of($purchaseReturnsQuery->sum('paid_amount') ?? 0);
        $totalInflow = $sales->add($receipts)->add($purchaseReturns);

        $purchases = Money::of($purchasesQuery->sum('paid_amount') ?? 0);
        $payments = Money::of($paymentsQuery->sum('amount') ?? 0);
        $saleReturns = Money::of($saleReturnsQuery->sum('paid_amount') ?? 0);
        $expenses = $includeExpenses ? Money::of($expensesQuery->sum('amount') ?? 0) : Money::zero();
        $totalOutflow = $purchases->add($payments)->add($saleReturns)->add($expenses);

        return [
            'inflow' => [
                'sales' => $sales->getAmount(),
                'receipt_vouchers' => $receipts->getAmount(),
                'purchase_returns' => $purchaseReturns->getAmount(),
                'total' => $totalInflow->getAmount(),
            ],
            'outflow' => [
                'purchases' => $purchases->getAmount(),
                'payment_vouchers' => $payments->getAmount(),
                'sale_returns' => $saleReturns->getAmount(),
                'expenses' => $expenses->getAmount(),
                'total' => $totalOutflow->getAmount(),
            ],
            'net_balance' => $totalInflow->subtract($totalOutflow)->getAmount(),
        ];
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
        $shouldIncludeExpenses = ($channel === 'CASH');

        if ($flowType === 'INFLOW') {
            $shouldIncludeExpenses = false;
        }

        if ($movementCategory) {
            $invoiceCategories = ['SALE', 'PURCHASE', 'SALE_RETURN', 'PURCHASE_RETURN'];
            $paymentCategories = ['RECEIPT_VOUCHER', 'PAYMENT_VOUCHER', 'SPLIT_SALE'];

            $shouldIncludeInvoices = in_array($movementCategory, $invoiceCategories, true);
            $shouldIncludePayments = in_array($movementCategory, $paymentCategories, true);
            $shouldIncludeExpenses = ($movementCategory === 'EXPENSE' && $channel === 'CASH');
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

            if ($movementCategory && in_array($movementCategory, ['SALE', 'PURCHASE', 'SALE_RETURN', 'PURCHASE_RETURN'], true)) {
                $invoiceQuery->where('invoices.type', $movementCategory);
            } else {
                $invoiceQuery->whereIn('invoices.type', ['SALE', 'PURCHASE', 'SALE_RETURN', 'PURCHASE_RETURN']);
                if ($flowType === 'INFLOW') {
                    $invoiceQuery->whereIn('invoices.type', ['SALE', 'PURCHASE_RETURN']);
                } elseif ($flowType === 'OUTFLOW') {
                    $invoiceQuery->whereIn('invoices.type', ['PURCHASE', 'SALE_RETURN']);
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
                      ->orWhereHas('invoice', fn($iq) => $iq->where('payment_method', 'SPLIT'));
                });

            if ($movementCategory === 'SPLIT_SALE') {
                $paymentQuery->whereNotNull('payments.invoice_id')
                    ->whereHas('invoice', fn($iq) => $iq->where('payment_method', 'SPLIT'));
            } elseif ($movementCategory === 'RECEIPT_VOUCHER') {
                $paymentQuery->where('payments.type', 'RECEIPT')->whereNull('payments.invoice_id');
            } elseif ($movementCategory === 'PAYMENT_VOUCHER') {
                $paymentQuery->where('payments.type', 'PAYMENT')->whereNull('payments.invoice_id');
            } else {
                if ($flowType === 'INFLOW') {
                    $paymentQuery->where('payments.type', 'RECEIPT');
                } elseif ($flowType === 'OUTFLOW') {
                    $paymentQuery->where('payments.type', 'PAYMENT');
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

            if ($channel === 'CASH') {
                $expenseQuery->where(function ($q) {
                    $q->whereNull('expenses.payment_method')
                      ->orWhere('expenses.payment_method', 'CASH');
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
