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
            ->when($fromDate, fn($q) => $q->whereDate('date', '>=', $fromDate))
            ->when($toDate, fn($q) => $q->whereDate('date', '<=', $toDate));

        $returnsQuery = Invoice::where('type', 'SALE_RETURN')
            ->when($fromDate, fn($q) => $q->whereDate('date', '>=', $fromDate))
            ->when($toDate, fn($q) => $q->whereDate('date', '<=', $toDate));

        $grossSales = Money::of((float) $salesQuery->sum('total'));
        $saleReturns = Money::of((float) $returnsQuery->sum('total'));
        $netSales = $grossSales->subtract($saleReturns);
        $shippingRevenue = Money::of((float) $salesQuery->sum('shipping_amount'));
        $productSales = Money::of((float) $salesQuery->sum('subtotal'));
        $discounts = Money::of((float) $salesQuery->sum('discount'));

        // 2. حساب تكلفة البضاعة المباعة (COGS)
        $cogsSales = Money::of($this->calculateCogs('SALE', $fromDate, $toDate));
        $cogsReturns = Money::of($this->calculateCogs('SALE_RETURN', $fromDate, $toDate));
        $netCogs = $cogsSales->subtract($cogsReturns);

        // 3. إجمالي وصافي الربح
        $grossProfit = $netSales->subtract($netCogs);

        $expensesQuery = Expense::query()
            ->when($fromDate, fn($q) => $q->whereDate('date', '>=', $fromDate))
            ->when($toDate, fn($q) => $q->whereDate('date', '<=', $toDate));

        $totalExpenses = Money::of((float) $expensesQuery->sum('amount'));
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
    protected function calculateCogs(string $invoiceType, ?string $fromDate, ?string $toDate): float
    {
        return (float) InvoiceItem::whereHas('invoice', function ($q) use ($invoiceType, $fromDate, $toDate) {
            $q->where('type', $invoiceType)
              ->when($fromDate, fn($iq) => $iq->whereDate('date', '>=', $fromDate))
              ->when($toDate, fn($iq) => $iq->whereDate('date', '<=', $toDate));
        })->sum(DB::raw('quantity * purchase_price_at_sale'));
    }

    /**
     * ملخص المبيعات وطرق الدفع
     */
    public function getSalesReport(User $user, ?string $fromDate = null, ?string $toDate = null): array
    {
        $query = Invoice::query()
            ->when($user->isMandob(), fn($q) => $q->where('created_by', $user->id))
            ->when($fromDate, fn($q) => $q->whereDate('date', '>=', $fromDate))
            ->when($toDate, fn($q) => $q->whereDate('date', '<=', $toDate));

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
            'total_sales' => (float) ($saleRow?->total_amount ?? 0),
            'total_shipping' => (float) ($saleRow?->shipping_amount ?? 0),
            'total_purchases' => (float) ($purchaseRow?->total_amount ?? 0),
            'total_sale_returns' => (float) ($saleReturnRow?->total_amount ?? 0),
            'total_purchase_returns' => (float) ($purchaseReturnRow?->total_amount ?? 0),
            'sales_paid' => (float) ($saleRow?->paid_amount ?? 0),
            'sales_remaining' => (float) ($saleRow?->remaining_amount ?? 0),
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
            $qty = (float) $product->quantity;
            $purchasePrice = $user->isMandob() ? null : (float) $product->purchase_price;
            $salePrice = (float) $product->sale_price;
            $minQty = $product->min_quantity !== null ? (float) $product->min_quantity : null;

            $costVal = $user->isMandob() ? null : ($qty * (float) $product->purchase_price);
            $retailVal = $qty * $salePrice;
            $isLowStock = $minQty !== null && $qty <= $minQty;

            $totalQuantity += $qty;
            if (!$user->isMandob()) {
                $totalCost = $totalCost->add($costVal);
            }
            $totalRetail = $totalRetail->add($retailVal);
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
                'cost_value' => $costVal,
                'retail_value' => $retailVal,
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
            $salesQuery->whereDate('date', '>=', $fromDate);
            $splitSalesQuery->whereDate('date', '>=', $fromDate);
            $receiptsQuery->whereDate('date', '>=', $fromDate);
            $purchaseReturnsQuery->whereDate('date', '>=', $fromDate);
            $purchasesQuery->whereDate('date', '>=', $fromDate);
            $paymentsQuery->whereDate('date', '>=', $fromDate);
            $saleReturnsQuery->whereDate('date', '>=', $fromDate);
            $expensesQuery->whereDate('date', '>=', $fromDate);
        }
        if ($toDate) {
            $salesQuery->whereDate('date', '<=', $toDate);
            $splitSalesQuery->whereDate('date', '<=', $toDate);
            $receiptsQuery->whereDate('date', '<=', $toDate);
            $purchaseReturnsQuery->whereDate('date', '<=', $toDate);
            $purchasesQuery->whereDate('date', '<=', $toDate);
            $paymentsQuery->whereDate('date', '<=', $toDate);
            $saleReturnsQuery->whereDate('date', '<=', $toDate);
            $expensesQuery->whereDate('date', '<=', $toDate);
        }

        $directSales = Money::of((float) $salesQuery->sum('paid_amount'));
        $splitSales = Money::of((float) $splitSalesQuery->sum('amount'));
        $sales = $directSales->add($splitSales);
        $receipts = Money::of((float) $receiptsQuery->sum('amount'));
        $purchaseReturns = Money::of((float) $purchaseReturnsQuery->sum('paid_amount'));
        $totalInflow = $sales->add($receipts)->add($purchaseReturns);

        $purchases = Money::of((float) $purchasesQuery->sum('paid_amount'));
        $payments = Money::of((float) $paymentsQuery->sum('amount'));
        $saleReturns = Money::of((float) $saleReturnsQuery->sum('paid_amount'));
        $expenses = $includeExpenses ? Money::of((float) $expensesQuery->sum('amount')) : Money::zero();
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
}
