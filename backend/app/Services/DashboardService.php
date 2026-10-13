<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    /**
     * تجميع بيانات وإحصائيات لوحة القيادة مع التخزين المؤقت السريع (Cache)
     */
    public function getDashboardData(User $user): array
    {
        $today = now()->toDateString();
        $canViewProfits = $user->canViewProfits();
        $cacheKey = "dashboard_{$user->getAccountId()}_{$user->id}_{$today}_" . ($canViewProfits ? 'admin' : 'user');

        if (app()->runningUnitTests()) {
            return $this->computeDashboardData($user, $today, $canViewProfits);
        }

        return Cache::remember($cacheKey, 30, fn() => $this->computeDashboardData($user, $today, $canViewProfits));
    }

    /**
     * مسح كاش لوحة القيادة للمستخدم
     */
    public function clearCache(User $user): void
    {
        $today = now()->toDateString();
        Cache::forget("dashboard_{$user->getAccountId()}_{$user->id}_{$today}_admin");
        Cache::forget("dashboard_{$user->getAccountId()}_{$user->id}_{$today}_user");
    }

    /**
     * حساب إحصائيات لوحة القيادة الفعلية
     */
    protected function computeDashboardData(User $user, string $today, bool $canViewProfits): array
    {
        $startOfMonth = now()->startOfMonth()->toDateString();
        $endOfMonth = now()->endOfMonth()->toDateString();

        $todaySales = $this->calculateSalesBetween($user, $today, $today);
        $monthSales = $this->calculateSalesBetween($user, $startOfMonth, $endOfMonth);

        if ($canViewProfits) {
            $profitData = $this->calculateTodayProfit($today, $todaySales['net']);
            $todayExpenses = $profitData['today_expenses'];
            $todayProfit = $profitData['today_net_profit'];
        } else {
            $todayExpenses = (float) Expense::whereDate('date', $today)
                ->when($user->isManager() && $user->branch_id, function ($q) use ($user) {
                    $q->where(function ($sub) use ($user) {
                        $sub->whereHas('treasury', fn($t) => $t->where('branch_id', $user->branch_id))
                            ->orWhereHas('creator', fn($c) => $c->where('branch_id', $user->branch_id));
                    });
                })
                ->when($user->isMandob() || $user->isCashier(), fn($q) => $q->where('created_by', $user->id))
                ->sum('amount');
            $todayProfit = null;
        }

        $cashFlowData = $this->calculateTodayCashFlow($user, $today, $todayExpenses);
        $recentActivities = $this->getRecentActivities($user);

        return [
            'today' => $today,
            'kpis' => [
                'today_sales' => $todaySales['net'],
                'today_gross_sales' => $todaySales['gross'],
                'today_cash_sales' => $todaySales['cash'],
                'today_courier_pending_sales' => $todaySales['courier_pending'],
                'today_electronic_sales' => $todaySales['electronic'],
                'today_credit_sales' => $todaySales['credit'],
                'today_returns' => $todaySales['returns'],
                'today_profit' => $todayProfit,
                'today_expenses' => $todayExpenses,
                'today_cash_flow' => $cashFlowData['net_cash_flow'],
                'month_sales' => $monthSales['net'],
            ],
            'cash_flow' => $cashFlowData,
            'recent_activities' => $recentActivities,
        ];
    }

    /**
     * احتساب إجمالي وصافي وتفصيل المبيعات لفترة محددة
     */
    protected function calculateSalesBetween(User $user, string $startDate, string $endDate): array
    {
        $isEmployee = $user->isMandob() || $user->isCashier();

        $query = Invoice::query()
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($user->isManager() && $user->branch_id, fn($q) => $q->where('branch_id', $user->branch_id))
            ->whereDate('date', '>=', $startDate)
            ->whereDate('date', '<=', $endDate);

        $gross = Money::of((float) (clone $query)->where('type', 'SALE')->sum('total'));
        $cashSales = Money::of((float) (clone $query)->where('type', 'SALE')->where('payment_method', 'CASH')->sum('paid_amount'));
        $courierPendingSales = Money::of((float) (clone $query)->where('type', 'SALE')->where('payment_method', 'COURIER_COD')->sum('paid_amount'));
        $electronicSales = Money::of((float) (clone $query)->where('type', 'SALE')->whereIn('payment_method', ['CARD', 'INSTAPAY', 'VODAFONE_CASH', 'TRANSFER', 'BANK', 'WALLET'])->sum('paid_amount'));
        $creditSales = Money::of((float) (clone $query)->where('type', 'SALE')->sum('remaining_amount'));
        $returns = Money::of((float) (clone $query)->where('type', 'SALE_RETURN')->sum('total'));
        $net = $gross->subtract($returns);

        return [
            'gross' => $gross->getAmount(),
            'cash' => $cashSales->getAmount(),
            'courier_pending' => $courierPendingSales->getAmount(),
            'electronic' => $electronicSales->getAmount(),
            'credit' => $creditSales->getAmount(),
            'returns' => $returns->getAmount(),
            'net' => $net->getAmount(),
        ];
    }

    /**
     * احتساب أرباح اليوم ومصروفاته (خاصة بصاحب العمل فقط)
     */
    protected function calculateTodayProfit(string $today, float $todayNetSales): array
    {
        $cogsSales = (float) InvoiceItem::whereHas('invoice', fn($q) => $q->where('type', 'SALE')->whereDate('date', $today))
            ->sum(DB::raw('quantity * purchase_price_at_sale'));

        $cogsReturns = (float) InvoiceItem::whereHas('invoice', fn($q) => $q->where('type', 'SALE_RETURN')->whereDate('date', $today))
            ->sum(DB::raw('quantity * purchase_price_at_sale'));

        $netCogs = Money::of($cogsSales)->subtract($cogsReturns);
        $grossProfit = Money::of($todayNetSales)->subtract($netCogs);

        $todayExpenses = Money::of((float) Expense::whereDate('date', $today)->sum('amount'));
        $todayNetProfit = $grossProfit->subtract($todayExpenses);

        return [
            'today_net_profit' => $todayNetProfit->getAmount(),
            'today_expenses' => $todayExpenses->getAmount(),
        ];
    }

    /**
     * احتساب حركة النقدية (Cash Flow) لليوم
     */
    protected function calculateTodayCashFlow(User $user, string $today, float $todayExpenses): array
    {
        $isEmployee = $user->isMandob() || $user->isCashier();
        $isManager = $user->isManager() && $user->branch_id;

        $directCashSales = (float) Invoice::where('type', 'SALE')
            ->where('payment_method', 'CASH')
            ->whereDate('date', $today)
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($isManager, fn($q) => $q->where('branch_id', $user->branch_id))
            ->sum('paid_amount');

        $splitCashSales = (float) Payment::where('type', 'RECEIPT')
            ->where('method', 'CASH')
            ->whereHas('invoice', fn($q) => $q->where('payment_method', 'SPLIT')->when($isManager, fn($inv) => $inv->where('branch_id', $user->branch_id)))
            ->whereDate('date', $today)
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($isManager, fn($q) => $q->where(fn($sub) => $sub->whereHas('treasury', fn($t) => $t->where('branch_id', $user->branch_id))->orWhereHas('creator', fn($c) => $c->where('branch_id', $user->branch_id))))
            ->sum('amount');

        $cashSales = Money::of($directCashSales)->add($splitCashSales)->getAmount();

        $directElectronicSales = (float) Invoice::where('type', 'SALE')
            ->whereIn('payment_method', ['BANK', 'CARD', 'WALLET', 'INSTAPAY', 'VODAFONE_CASH', 'TRANSFER'])
            ->whereDate('date', $today)
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($isManager, fn($q) => $q->where('branch_id', $user->branch_id))
            ->sum('paid_amount');

        $splitElectronicSales = (float) Payment::where('type', 'RECEIPT')
            ->whereIn('method', ['BANK', 'CARD', 'WALLET', 'INSTAPAY', 'VODAFONE_CASH', 'TRANSFER'])
            ->whereHas('invoice', fn($q) => $q->where('payment_method', 'SPLIT')->when($isManager, fn($inv) => $inv->where('branch_id', $user->branch_id)))
            ->whereDate('date', $today)
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($isManager, fn($q) => $q->where(fn($sub) => $sub->whereHas('treasury', fn($t) => $t->where('branch_id', $user->branch_id))->orWhereHas('creator', fn($c) => $c->where('branch_id', $user->branch_id))))
            ->sum('amount');

        $electronicSales = Money::of($directElectronicSales)->add($splitElectronicSales)->getAmount();

        $cashReceipts = (float) Payment::where('type', 'RECEIPT')
            ->where('method', 'CASH')
            ->whereNull('invoice_id')
            ->whereDate('date', $today)
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($isManager, fn($q) => $q->where(fn($sub) => $sub->whereHas('treasury', fn($t) => $t->where('branch_id', $user->branch_id))->orWhereHas('creator', fn($c) => $c->where('branch_id', $user->branch_id))))
            ->sum('amount');

        $cashPurchaseReturns = $isEmployee ? 0.0 : (float) Invoice::where('type', 'PURCHASE_RETURN')
            ->where('payment_method', 'CASH')
            ->whereDate('date', $today)
            ->when($isManager, fn($q) => $q->where('branch_id', $user->branch_id))
            ->sum('paid_amount');

        $cashPurchases = $isEmployee ? 0.0 : (float) Invoice::where('type', 'PURCHASE')
            ->where('payment_method', 'CASH')
            ->whereDate('date', $today)
            ->when($isManager, fn($q) => $q->where('branch_id', $user->branch_id))
            ->sum('paid_amount');

        $cashPayments = $isEmployee ? 0.0 : (float) Payment::where('type', 'PAYMENT')
            ->where('method', 'CASH')
            ->whereNull('invoice_id')
            ->whereDate('date', $today)
            ->when($isManager, fn($q) => $q->where(fn($sub) => $sub->whereHas('treasury', fn($t) => $t->where('branch_id', $user->branch_id))->orWhereHas('creator', fn($c) => $c->where('branch_id', $user->branch_id))))
            ->sum('amount');

        $cashSaleReturns = (float) Invoice::where('type', 'SALE_RETURN')
            ->where('payment_method', 'CASH')
            ->whereDate('date', $today)
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($isManager, fn($q) => $q->where('branch_id', $user->branch_id))
            ->sum('paid_amount');

        $totalIn = Money::of($cashSales)->add($cashReceipts)->add($cashPurchaseReturns);
        $totalOut = Money::of($cashPurchases)->add($cashPayments)->add($cashSaleReturns)->add($todayExpenses);
        $netFlow = $totalIn->subtract($totalOut);

        return [
            'inflow' => [
                'cash_sales' => $cashSales,
                'electronic_sales' => $electronicSales,
                'receipt_vouchers' => $cashReceipts,
                'purchase_returns' => $cashPurchaseReturns,
                'total' => $totalIn->getAmount(),
            ],
            'outflow' => [
                'cash_purchases' => $cashPurchases,
                'payment_vouchers' => $cashPayments,
                'sale_returns' => $cashSaleReturns,
                'expenses' => $todayExpenses,
                'total' => $totalOut->getAmount(),
            ],
            'net_cash_flow' => $netFlow->getAmount(),
        ];
    }

    /**
     * استرجاع آخر 5 حركات مسجلة
     */
    protected function getRecentActivities(User $user): Collection
    {
        $isEmployee = $user->isMandob() || $user->isCashier();
        $isManager = $user->isManager() && $user->branch_id;

        $invoices = Invoice::with(['party', 'creator'])
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($isManager, fn($q) => $q->where('branch_id', $user->branch_id))
            ->latest('created_at')
            ->limit(5)
            ->get()
            ->map(function ($inv) {
                $labels = [
                    'SALE' => 'فاتورة بيع',
                    'PURCHASE' => 'فاتورة شراء',
                    'SALE_RETURN' => 'مرتجع بيع',
                    'PURCHASE_RETURN' => 'مرتجع شراء',
                ];
                $typeStr = $inv->type instanceof \BackedEnum ? $inv->type->value : (string) $inv->type;
                $roleStr = $inv->creator?->role instanceof \BackedEnum ? $inv->creator?->role->value : ($inv->creator?->role ?? 'OWNER');
                return [
                    'id' => $inv->id,
                    'category' => 'INVOICE',
                    'type' => $typeStr,
                    'type_label' => ($inv->type instanceof \BackedEnum && method_exists($inv->type, 'label')) ? $inv->type->label() : ($labels[$typeStr] ?? $typeStr),
                    'reference' => $inv->invoice_number,
                    'party_name' => $inv->party?->name ?? 'عميل/مورد نقدي',
                    'created_by_name' => $inv->creator?->name ?? 'صاحب المتجر',
                    'created_by_role' => $roleStr,
                    'amount' => (float) $inv->total,
                    'date' => $inv->date->format('Y-m-d'),
                    'created_at' => $inv->created_at->toDateTimeString(),
                ];
            });

        $payments = Payment::with(['party', 'creator'])
            ->whereNull('invoice_id')
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($isManager, fn($q) => $q->where(fn($sub) => $sub->whereHas('treasury', fn($t) => $t->where('branch_id', $user->branch_id))->orWhereHas('creator', fn($c) => $c->where('branch_id', $user->branch_id))))
            ->latest('created_at')
            ->limit(5)
            ->get()
            ->map(function ($pay) {
                $typeStr = $pay->type instanceof \BackedEnum ? $pay->type->value : (string) $pay->type;
                $roleStr = $pay->creator?->role instanceof \BackedEnum ? $pay->creator?->role->value : ($pay->creator?->role ?? 'OWNER');
                return [
                    'id' => $pay->id,
                    'category' => 'PAYMENT',
                    'type' => $typeStr,
                    'type_label' => ($pay->type instanceof \BackedEnum && method_exists($pay->type, 'label')) ? $pay->type->label() : ($typeStr === 'RECEIPT' ? 'سند قبض' : 'سند صرف'),
                    'reference' => 'سند #' . $pay->id,
                    'party_name' => $pay->party?->name ?? '-',
                    'created_by_name' => $pay->creator?->name ?? 'صاحب المتجر',
                    'created_by_role' => $roleStr,
                    'amount' => (float) $pay->amount,
                    'date' => $pay->date->format('Y-m-d'),
                    'created_at' => $pay->created_at->toDateTimeString(),
                ];
            });

        $expenses = Expense::with('creator')
            ->latest('created_at')
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($isManager, fn($q) => $q->where(fn($sub) => $sub->whereHas('treasury', fn($t) => $t->where('branch_id', $user->branch_id))->orWhereHas('creator', fn($c) => $c->where('branch_id', $user->branch_id))))
            ->limit(5)
            ->get()
            ->map(function ($exp) {
                $roleStr = $exp->creator?->role instanceof \BackedEnum ? $exp->creator?->role->value : ($exp->creator?->role ?? 'OWNER');
                return [
                    'id' => $exp->id,
                    'category' => 'EXPENSE',
                    'type' => 'EXPENSE',
                    'type_label' => 'مصروف',
                    'reference' => $exp->title,
                    'party_name' => $exp->category ?? 'مصروفات عامة',
                    'created_by_name' => $exp->creator?->name ?? 'صاحب المتجر',
                    'created_by_role' => $roleStr,
                    'amount' => (float) $exp->amount,
                    'date' => $exp->date->format('Y-m-d'),
                    'created_at' => $exp->created_at->toDateTimeString(),
                ];
            });

        return $invoices->concat($payments)->concat($expenses)
            ->sortByDesc('created_at')
            ->values()
            ->take(5);
    }
}
