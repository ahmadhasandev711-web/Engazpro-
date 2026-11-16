<?php

namespace App\Services;

use App\Enums\InvoiceType;
use App\Enums\LedgerSource;
use App\Enums\PaymentMethod;
use App\Enums\PaymentType;
use App\Enums\TreasuryType;
use App\Enums\UserRole;
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
        $todaySales = $this->calculateSalesBetween($user, $today, $today);
        $monthSales = $this->calculateSalesBetween($user, now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString());
        ['expenses' => $todayExpenses, 'profit' => $todayProfit] = $this->resolveTodayProfitAndExpenses($user, $today, $canViewProfits, $todaySales['net']);
        $cashFlowData = $this->calculateTodayCashFlow($user, $today, $todayExpenses);

        return [
            'today' => $today,
            'kpis' => $this->buildKpisPayload($todaySales, $monthSales['net'], $todayProfit, $todayExpenses, $cashFlowData['net_cash_flow']),
            'cash_flow' => $cashFlowData,
            'recent_activities' => $this->getRecentActivities($user),
        ];
    }

    private function resolveTodayProfitAndExpenses(User $user, string $today, bool $canViewProfits, float $todayNetSales): array
    {
        if ($canViewProfits) {
            $profitData = $this->calculateTodayProfit($today, $todayNetSales);
            return ['expenses' => $profitData['today_expenses'], 'profit' => $profitData['today_net_profit']];
        }

        $expensesSum = Expense::whereBetween('date', [$today, $today . ' 23:59:59'])
            ->when($user->isManager() && $user->branch_id, fn($q) => $q->where(fn($sub) => $sub->whereHas('treasury', fn($t) => $t->where('branch_id', $user->branch_id))->orWhereHas('creator', fn($c) => $c->where('branch_id', $user->branch_id))))
            ->when($user->isMandob() || $user->isCashier(), fn($q) => $q->where('created_by', $user->id))
            ->sum('amount');

        return ['expenses' => Money::of($expensesSum ?? 0)->getAmount(), 'profit' => null];
    }

    private function buildKpisPayload(array $todaySales, float $monthNet, ?float $todayProfit, float $todayExpenses, float $netCashFlow): array
    {
        return [
            'today_sales' => $todaySales['net'],
            'today_gross_sales' => $todaySales['gross'],
            'today_cash_sales' => $todaySales['cash'],
            'today_courier_pending_sales' => $todaySales['courier_pending'],
            'today_electronic_sales' => $todaySales['electronic'],
            'today_credit_sales' => $todaySales['credit'],
            'today_returns' => $todaySales['returns'],
            'today_profit' => $todayProfit,
            'today_expenses' => $todayExpenses,
            'today_cash_flow' => $netCashFlow,
            'month_sales' => $monthNet,
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
            ->where('date', '>=', $startDate)
            ->where('date', '<=', $endDate . ' 23:59:59');

        $gross = Money::of((clone $query)->where('type', InvoiceType::SALE->value)->sum('total') ?? 0);
        $cashSales = Money::of((clone $query)->where('type', InvoiceType::SALE->value)->where('payment_method', PaymentMethod::CASH->value)->sum('paid_amount') ?? 0);
        $courierPendingSales = Money::of((clone $query)->where('type', InvoiceType::SALE->value)->where('payment_method', PaymentMethod::COURIER_COD->value)->sum('paid_amount') ?? 0);
        $electronicSales = Money::of((clone $query)->where('type', InvoiceType::SALE->value)->whereIn('payment_method', [PaymentMethod::CARD->value, PaymentMethod::INSTAPAY->value, PaymentMethod::VODAFONE_CASH->value, PaymentMethod::TRANSFER->value, TreasuryType::BANK->value, TreasuryType::WALLET->value])->sum('paid_amount') ?? 0);
        $creditSales = Money::of((clone $query)->where('type', InvoiceType::SALE->value)->sum('remaining_amount') ?? 0);
        $returns = Money::of((clone $query)->where('type', InvoiceType::SALE_RETURN->value)->sum('total') ?? 0);
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
        $dayRange = [$today, $today . ' 23:59:59'];

        $cogsSales = InvoiceItem::whereHas('invoice', fn($q) => $q->where('type', InvoiceType::SALE->value)->whereBetween('date', $dayRange))
            ->sum(DB::raw('quantity * purchase_price_at_sale'));

        $cogsReturns = InvoiceItem::whereHas('invoice', fn($q) => $q->where('type', InvoiceType::SALE_RETURN->value)->whereBetween('date', $dayRange))
            ->sum(DB::raw('quantity * purchase_price_at_sale'));

        $netCogs = Money::of($cogsSales ?? 0)->subtract(Money::of($cogsReturns ?? 0));
        $grossProfit = Money::of($todayNetSales)->subtract($netCogs);

        $todayExpenses = Money::of(Expense::whereBetween('date', $dayRange)->sum('amount') ?? 0);
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
        $isManager = (bool) ($user->isManager() && $user->branch_id);
        $dayRange = [$today, $today . ' 23:59:59'];

        $cashSales = $this->sumDailySalesByMethods($user, $isEmployee, $isManager, $dayRange, [PaymentMethod::CASH->value]);
        $electronicMethods = [TreasuryType::BANK->value, PaymentMethod::CARD->value, TreasuryType::WALLET->value, PaymentMethod::INSTAPAY->value, PaymentMethod::VODAFONE_CASH->value, PaymentMethod::TRANSFER->value];
        $electronicSales = $this->sumDailySalesByMethods($user, $isEmployee, $isManager, $dayRange, $electronicMethods);

        $cashReceipts = $this->sumDailyCashVouchers($user, $isEmployee, $isManager, $dayRange, PaymentType::RECEIPT->value);
        $cashPurchaseReturns = $isEmployee ? 0.0 : $this->sumDailyCashInvoices($user, false, $isManager, $dayRange, InvoiceType::PURCHASE_RETURN->value);
        $cashPurchases = $isEmployee ? 0.0 : $this->sumDailyCashInvoices($user, false, $isManager, $dayRange, InvoiceType::PURCHASE->value);
        $cashPayments = $isEmployee ? 0.0 : $this->sumDailyCashVouchers($user, false, $isManager, $dayRange, PaymentType::PAYMENT->value);
        $cashSaleReturns = $this->sumDailyCashInvoices($user, $isEmployee, $isManager, $dayRange, InvoiceType::SALE_RETURN->value);

        $totalIn = Money::of($cashSales)->add($cashReceipts)->add($cashPurchaseReturns);
        $totalOut = Money::of($cashPurchases)->add($cashPayments)->add($cashSaleReturns)->add($todayExpenses);

        return [
            'inflow' => ['cash_sales' => $cashSales, 'electronic_sales' => $electronicSales, 'receipt_vouchers' => $cashReceipts, 'purchase_returns' => $cashPurchaseReturns, 'total' => $totalIn->getAmount()],
            'outflow' => ['cash_purchases' => $cashPurchases, 'payment_vouchers' => $cashPayments, 'sale_returns' => $cashSaleReturns, 'expenses' => $todayExpenses, 'total' => $totalOut->getAmount()],
            'net_cash_flow' => $totalIn->subtract($totalOut)->getAmount(),
        ];
    }

    private function sumDailySalesByMethods(User $user, bool $isEmployee, bool $isManager, array $dayRange, array $methods): float
    {
        $direct = Invoice::where('type', InvoiceType::SALE->value)->whereIn('payment_method', $methods)->whereBetween('date', $dayRange)
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))->when($isManager, fn($q) => $q->where('branch_id', $user->branch_id))->sum('paid_amount');

        $split = Payment::where('type', PaymentType::RECEIPT->value)->whereIn('method', $methods)
            ->whereHas('invoice', fn($q) => $q->where('payment_method', PaymentMethod::SPLIT->value)->when($isManager, fn($inv) => $inv->where('branch_id', $user->branch_id)))
            ->whereBetween('date', $dayRange)->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($isManager, fn($q) => $q->where(fn($sub) => $sub->whereHas('treasury', fn($t) => $t->where('branch_id', $user->branch_id))->orWhereHas('creator', fn($c) => $c->where('branch_id', $user->branch_id))))
            ->sum('amount');

        return Money::of($direct ?? 0)->add(Money::of($split ?? 0))->getAmount();
    }

    private function sumDailyCashVouchers(User $user, bool $isEmployee, bool $isManager, array $dayRange, string $type): float
    {
        $sum = Payment::where('type', $type)->where('method', PaymentMethod::CASH->value)->whereNull('invoice_id')->whereBetween('date', $dayRange)
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($isManager, fn($q) => $q->where(fn($sub) => $sub->whereHas('treasury', fn($t) => $t->where('branch_id', $user->branch_id))->orWhereHas('creator', fn($c) => $c->where('branch_id', $user->branch_id))))
            ->sum('amount');

        return Money::of($sum ?? 0)->getAmount();
    }

    private function sumDailyCashInvoices(User $user, bool $isEmployee, bool $isManager, array $dayRange, string $type): float
    {
        $sum = Invoice::where('type', $type)->where('payment_method', PaymentMethod::CASH->value)->whereBetween('date', $dayRange)
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($isManager, fn($q) => $q->where('branch_id', $user->branch_id))
            ->sum('paid_amount');

        return Money::of($sum ?? 0)->getAmount();
    }

    /**
     * استرجاع آخر 5 حركات مسجلة
     */
    protected function getRecentActivities(User $user): Collection
    {
        $isEmployee = $user->isMandob() || $user->isCashier();
        $isManager = (bool) ($user->isManager() && $user->branch_id);

        return $this->fetchRecentInvoices($user, $isEmployee, $isManager)
            ->concat($this->fetchRecentPayments($user, $isEmployee, $isManager))
            ->concat($this->fetchRecentExpenses($user, $isEmployee, $isManager))
            ->sortByDesc('created_at')
            ->values()
            ->take(5);
    }

    private function fetchRecentInvoices(User $user, bool $isEmployee, bool $isManager): Collection
    {
        $labels = [InvoiceType::SALE->value => 'فاتورة بيع', InvoiceType::PURCHASE->value => 'فاتورة شراء', InvoiceType::SALE_RETURN->value => 'مرتجع بيع', InvoiceType::PURCHASE_RETURN->value => 'مرتجع شراء'];

        return Invoice::with(['party', 'creator'])->when($isEmployee, fn($q) => $q->where('created_by', $user->id))->when($isManager, fn($q) => $q->where('branch_id', $user->branch_id))
            ->latest('created_at')->limit(5)->get()->map(function ($inv) use ($labels) {
                $typeStr = $inv->type instanceof \BackedEnum ? $inv->type->value : (string) $inv->type;
                $roleStr = $inv->creator?->role instanceof \BackedEnum ? $inv->creator?->role->value : ($inv->creator?->role ?? UserRole::OWNER->value);
                return [
                    'id' => $inv->id, 'category' => LedgerSource::INVOICE->value, 'type' => $typeStr,
                    'type_label' => ($inv->type instanceof \BackedEnum && method_exists($inv->type, 'label')) ? $inv->type->label() : ($labels[$typeStr] ?? $typeStr),
                    'reference' => $inv->invoice_number, 'party_name' => $inv->party?->name ?? 'عميل/مورد نقدي',
                    'created_by_name' => $inv->creator?->name ?? 'صاحب المتجر', 'created_by_role' => $roleStr,
                    'amount' => Money::of($inv->total ?? 0)->getAmount(), 'date' => $inv->date->format('Y-m-d'), 'created_at' => $inv->created_at->toDateTimeString(),
                ];
            });
    }

    private function fetchRecentPayments(User $user, bool $isEmployee, bool $isManager): Collection
    {
        return Payment::with(['party', 'creator'])->whereNull('invoice_id')->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($isManager, fn($q) => $q->where(fn($sub) => $sub->whereHas('treasury', fn($t) => $t->where('branch_id', $user->branch_id))->orWhereHas('creator', fn($c) => $c->where('branch_id', $user->branch_id))))
            ->latest('created_at')->limit(5)->get()->map(function ($pay) {
                $typeStr = $pay->type instanceof \BackedEnum ? $pay->type->value : (string) $pay->type;
                $roleStr = $pay->creator?->role instanceof \BackedEnum ? $pay->creator?->role->value : ($pay->creator?->role ?? UserRole::OWNER->value);
                return [
                    'id' => $pay->id, 'category' => LedgerSource::PAYMENT->value, 'type' => $typeStr,
                    'type_label' => ($pay->type instanceof \BackedEnum && method_exists($pay->type, 'label')) ? $pay->type->label() : ($typeStr === PaymentType::RECEIPT->value ? 'سند قبض' : 'سند صرف'),
                    'reference' => 'سند #' . $pay->id, 'party_name' => $pay->party?->name ?? '-',
                    'created_by_name' => $pay->creator?->name ?? 'صاحب المتجر', 'created_by_role' => $roleStr,
                    'amount' => Money::of($pay->amount ?? 0)->getAmount(), 'date' => $pay->date->format('Y-m-d'), 'created_at' => $pay->created_at->toDateTimeString(),
                ];
            });
    }

    private function fetchRecentExpenses(User $user, bool $isEmployee, bool $isManager): Collection
    {
        return Expense::with('creator')->latest('created_at')->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($isManager, fn($q) => $q->where(fn($sub) => $sub->whereHas('treasury', fn($t) => $t->where('branch_id', $user->branch_id))->orWhereHas('creator', fn($c) => $c->where('branch_id', $user->branch_id))))
            ->limit(5)->get()->map(fn($exp) => [
                'id' => $exp->id, 'category' => 'EXPENSE', 'type' => 'EXPENSE', 'type_label' => 'مصروف', 'reference' => $exp->title,
                'party_name' => $exp->category ?? 'مصروفات عامة', 'created_by_name' => $exp->creator?->name ?? 'صاحب المتجر',
                'created_by_role' => $exp->creator?->role instanceof \BackedEnum ? $exp->creator?->role->value : ($exp->creator?->role ?? UserRole::OWNER->value),
                'amount' => Money::of($exp->amount ?? 0)->getAmount(), 'date' => $exp->date->format('Y-m-d'), 'created_at' => $exp->created_at->toDateTimeString(),
            ]);
    }
}
