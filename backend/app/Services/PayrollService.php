<?php

namespace App\Services;

use App\Enums\CommissionType;
use App\Enums\EmployeeAdjustmentType;
use App\Enums\InvoiceType;
use App\Enums\PaymentMethod;
use App\Enums\UserRole;
use App\Exceptions\PayrollDomainException;
use App\Models\EmployeeAdjustment;
use App\Models\Invoice;
use App\Models\PayrollPayout;
use App\Models\Treasury;
use App\Models\User;
use App\Support\Money;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class PayrollService
{
    public function __construct(
        protected ExpenseService $expenseService,
        protected TreasuryService $treasuryService
    ) {}

    /**
     * احتساب كشف حساب مسير الراتب والعمولات لموظف عن شهر محدد
     */
    public function calculateMonthlyPayroll(User $employee, string $yearMonth): array
    {
        $this->assertEligibleForPayroll($employee);
        $date = Carbon::createFromFormat('Y-m', $yearMonth);
        $startDate = $date->copy()->startOfMonth()->toDateString();
        $endDate = $date->copy()->endOfMonth()->toDateString() . ' 23:59:59';

        $salesQuery = $this->buildMonthlyInvoiceTypeQuery($employee, InvoiceType::SALE, $startDate, $endDate);
        $grossSalesMoney = Money::of($salesQuery->sum('total') ?? 0);
        $saleReturnsMoney = Money::of($this->buildMonthlyInvoiceTypeQuery($employee, InvoiceType::SALE_RETURN, $startDate, $endDate)->sum('total') ?? 0);
        $netSalesMoney = $grossSalesMoney->subtract($saleReturnsMoney);
        $totalSalesAmount = $netSalesMoney->isNegative() ? 0.0 : $netSalesMoney->getAmount();
        $invoicesCount = (int) (clone $salesQuery)->whereNull('exchange_id')->count();

        $commissionType = $employee->commission_type instanceof CommissionType
            ? $employee->commission_type
            : CommissionType::tryFrom($employee->commission_type ?? '') ?? CommissionType::NONE;
        $commissionRate = Money::of($employee->commission_rate ?? 0)->getAmount();
        $commissionMoney = $this->computeCommissionMoney($commissionType, $commissionRate, $totalSalesAmount, $invoicesCount);

        [$adjustments, $bonusesTotal, $deductionsTotal] = $this->aggregateMonthlyAdjustments($employee, $startDate, $endDate);
        $payout = PayrollPayout::where('user_id', $employee->getAccountId())->where('employee_id', $employee->id)->where('month', $yearMonth)->with(['treasury:id,name,type', 'payer:id,name'])->first();

        return $this->formatMonthlyPayrollSummary($employee, $yearMonth, $totalSalesAmount, $grossSalesMoney->getAmount(), $saleReturnsMoney->getAmount(), $invoicesCount, $commissionType, $commissionRate, $commissionMoney, $bonusesTotal, $deductionsTotal, $payout, $adjustments);
    }

    private function buildMonthlyInvoiceTypeQuery(User $employee, InvoiceType $type, string $startDate, string $endDate)
    {
        $query = Invoice::where('user_id', $employee->getAccountId())->where('type', $type->value)->whereBetween('date', [$startDate, $endDate]);

        return $employee->isManager()
            ? $query->where('branch_id', $employee->branch_id)->nonEcommerce()
            : $query->where(fn ($q) => $q->where('salesperson_id', $employee->id)->orWhere(fn ($sub) => $sub->whereNull('salesperson_id')->nonEcommerce()->where('created_by', $employee->id)));
    }

    private function computeCommissionMoney(CommissionType $type, float $rate, float $totalSales, int $invoicesCount): Money
    {
        if ($type === CommissionType::PERCENTAGE_OF_SALES && $rate > 0) {
            return Money::of($totalSales)->multiply($rate / 100);
        }
        if ($type === CommissionType::FIXED_PER_INVOICE && $rate > 0) {
            return Money::of($rate)->multiply($invoicesCount);
        }

        return Money::zero();
    }

    private function aggregateMonthlyAdjustments(User $employee, string $startDate, string $endDate): array
    {
        $adjustments = EmployeeAdjustment::where('user_id', $employee->getAccountId())
            ->where('employee_id', $employee->id)->whereBetween('date', [$startDate, $endDate])
            ->with('creator:id,name')->orderBy('date', 'desc')->get();

        $bonuses = Money::zero();
        $deductions = Money::zero();
        foreach ($adjustments as $adj) {
            $adjMoney = Money::of($adj->amount);
            $adj->type === EmployeeAdjustmentType::BONUS ? ($bonuses = $bonuses->add($adjMoney)) : ($deductions = $deductions->add($adjMoney));
        }

        return [$adjustments, $bonuses, $deductions];
    }

    private function formatMonthlyPayrollSummary(User $employee, string $yearMonth, float $totalSales, float $grossSales, float $saleReturns, int $invoicesCount, CommissionType $commType, float $commRate, Money $commMoney, Money $bonuses, Money $deductions, ?PayrollPayout $payout, $adjustments): array
    {
        $baseSalaryMoney = Money::of($employee->base_salary ?? 0);
        $netPayableMoney = $baseSalaryMoney->add($commMoney)->add($bonuses)->subtract($deductions);

        return [
            'employee' => ['id' => $employee->id, 'name' => $employee->name, 'role' => $employee->role, 'branch_id' => $employee->branch_id, 'base_salary' => $baseSalaryMoney->getAmount(), 'commission_type' => $commType->value, 'commission_rate' => $commRate],
            'month' => $yearMonth, 'is_manager_scope' => $employee->isManager(), 'gross_sales' => $grossSales, 'sale_returns' => $saleReturns, 'total_sales' => $totalSales, 'invoices_count' => $invoicesCount,
            'base_salary' => $baseSalaryMoney->getAmount(), 'commission_amount' => $commMoney->getAmount(),
            'total_bonuses' => $bonuses->getAmount(), 'total_deductions' => $deductions->getAmount(),
            'net_payable' => max(0, $netPayableMoney->getAmount()), 'is_paid' => (bool) $payout,
            'payout' => $payout ? ['id' => $payout->id, 'net_paid' => Money::of($payout->net_paid ?? 0)->getAmount(), 'payment_method' => $payout->payment_method?->value ?? $payout->payment_method, 'treasury' => $payout->treasury ? ['id' => $payout->treasury->id, 'name' => $payout->treasury->name] : null, 'paid_at' => $payout->paid_at->toIso8601String(), 'paid_by_name' => $payout->payer?->name, 'notes' => $payout->notes] : null,
            'adjustments' => $adjustments->map(fn($adj) => ['id' => $adj->id, 'type' => $adj->type?->value ?? $adj->type, 'amount' => Money::of($adj->amount ?? 0)->getAmount(), 'date' => $adj->date->toDateString(), 'reason' => $adj->reason, 'created_by_name' => $adj->creator?->name]),
        ];
    }

    /**
     * إضافة تسوية (مكافأة، خصم، سلفة) لموظف
     */
    public function addAdjustment(User $actor, User $employee, array $data): EmployeeAdjustment
    {
        $this->assertCanManageEmployee($actor, $employee);
        $this->assertEligibleForPayroll($employee);

        $type = $data['type'] instanceof EmployeeAdjustmentType ? $data['type'] : EmployeeAdjustmentType::from($data['type']);
        $amount = Money::of($data['amount'])->getAmount();
        if ($amount <= 0) {
            throw new PayrollDomainException('قيمة التسوية يجب أن تكون أكبر من الصفر.', 'INVALID_AMOUNT');
        }

        $date = $data['date'] ?? now()->toDateString();
        $this->assertMonthUnpaid($employee->getAccountId(), $employee->id, Carbon::parse($date)->format('Y-m'), 'لا يمكن إضافة تسوية لشهر تم صرف راتبه مسبقاً.');

        return EmployeeAdjustment::create([
            'user_id' => $employee->getAccountId(),
            'employee_id' => $employee->id,
            'type' => $type,
            'amount' => $amount,
            'date' => $date,
            'reason' => $data['reason'] ?? null,
            'created_by' => $actor->id,
        ]);
    }

    /**
     * حذف تسوية قبل صرف الراتب
     */
    public function deleteAdjustment(User $actor, int $adjustmentId): void
    {
        $accountId = $actor->getAccountId();
        $adjustment = EmployeeAdjustment::where('user_id', $accountId)->findOrFail($adjustmentId);
        $employee = User::where('owner_id', $accountId)->findOrFail($adjustment->employee_id);

        $this->assertCanManageEmployee($actor, $employee);
        $this->assertMonthUnpaid($accountId, $employee->id, Carbon::parse($adjustment->date)->format('Y-m'), 'لا يمكن حذف تسوية لشهر تم صرف راتبه مسبقاً.');

        $adjustment->delete();
    }

    private function assertMonthUnpaid(int $accountId, int $employeeId, string $month, string $message): void
    {
        $alreadyPaid = PayrollPayout::where('user_id', $accountId)
            ->where('employee_id', $employeeId)
            ->where('month', $month)
            ->exists();

        if ($alreadyPaid) {
            throw new PayrollDomainException($message, 'MONTH_ALREADY_PAID');
        }
    }

    /**
     * صرف الراتب الشهري وخصمه من الخزينة المحددة وتسجيله كمصروف ذرياً
     */
    public function disbursePayroll(User $actor, User $employee, array $data): PayrollPayout
    {
        $this->assertCanManageEmployee($actor, $employee);
        $this->assertEligibleForPayroll($employee);

        $month = $data['month'];
        $accountId = $employee->getAccountId();
        if (PayrollPayout::where('user_id', $accountId)->where('employee_id', $employee->id)->where('month', $month)->exists()) {
            throw new PayrollDomainException('تم صرف راتب هذا الشهر مسبقاً ولا يمكن تكرار الصرف.', 'ALREADY_PAID');
        }

        $summary = $this->calculateMonthlyPayroll($employee, $month);
        $netPayable = Money::of($summary['net_payable'])->getAmount();
        if ($netPayable <= 0) {
            throw new PayrollDomainException('صافي الراتب المستحق يجب أن يكون أكبر من الصفر لإتمام الصرف.', 'ZERO_NET_PAYABLE');
        }

        $treasury = Treasury::where('user_id', $accountId)->findOrFail((int) $data['treasury_id']);
        if (!$actor->isOwnerOrAdmin() && !app(BranchScopeService::class)->canAccessTreasury($actor, $treasury)) {
            throw new PayrollDomainException('عذراً، يمكنك صرف الرواتب فقط من خزينة فرعك المصرح بها.', 'UNAUTHORIZED_TREASURY', 403);
        }
        $paymentMethod = !empty($data['payment_method'])
            ? ($data['payment_method'] instanceof PaymentMethod ? $data['payment_method'] : PaymentMethod::from($data['payment_method']))
            : PaymentMethod::CASH;

        return DB::transaction(fn() => $this->persistPayrollPayout($actor, $employee, $data, $summary, $treasury, $paymentMethod, $netPayable));
    }

    private function persistPayrollPayout(User $actor, User $employee, array $data, array $summary, Treasury $treasury, PaymentMethod $paymentMethod, float $netPayable): PayrollPayout
    {
        $month = $data['month'];
        $expense = $this->expenseService->createExpense($actor, [
            'title' => "صرف راتب شهر {$month} للموظف ({$employee->name})",
            'category' => 'رواتب وأجور',
            'amount' => $netPayable,
            'payment_method' => $paymentMethod->value,
            'treasury_id' => $treasury->id,
            'date' => now()->toDateString(),
            'notes' => $data['notes'] ?? null,
        ]);

        return PayrollPayout::create([
            'user_id' => $employee->getAccountId(),
            'employee_id' => $employee->id,
            'month' => $month,
            'base_salary' => $summary['base_salary'],
            'commission_amount' => $summary['commission_amount'],
            'total_bonuses' => $summary['total_bonuses'],
            'total_deductions' => $summary['total_deductions'],
            'net_paid' => $netPayable,
            'payment_method' => $paymentMethod,
            'treasury_id' => $treasury->id,
            'expense_id' => $expense->id,
            'notes' => $data['notes'] ?? null,
            'paid_by' => $actor->id,
            'paid_at' => now(),
        ]);
    }

    /**
     * التحقق من صلاحية الإدارة على الموظف (المالك يصرف للجميع، والمدير لموظفي فرعه فقط ولا يصرف لنفسه)
     */
    protected function assertCanManageEmployee(User $actor, User $employee): void
    {
        if ($actor->isOwnerOrAdmin()) {
            return;
        }

        if ($actor->isManager()) {
            if ($actor->id === $employee->id) {
                throw new PayrollDomainException('لا يمكنك إدارة أو صرف راتبك الشخصي، يتم صرف راتب المدير بواسطة مالك المنشأة.', 'MANAGER_CANNOT_PAY_SELF', 403);
            }
            if ($actor->branch_id !== null && $employee->branch_id !== $actor->branch_id) {
                throw new PayrollDomainException('ليس لديك صلاحية لإدارة موظفين خارج فرعك.', 'UNAUTHORIZED_BRANCH', 403);
            }
            return;
        }

        throw new PayrollDomainException('غير مصرح لك بإدارة رواتب الموظفين.', 'UNAUTHORIZED_PAYROLL', 403);
    }

    /**
     * التحقق من أن الموظف مستحق للرواتب (استثناء المالك والأدمن)
     */
    protected function assertEligibleForPayroll(User $employee): void
    {
        if ($employee->isOwnerOrAdmin()) {
            throw new PayrollDomainException('مالك المنشأة ومدير النظام مستثنون من مسير رواتب الموظفين.', 'OWNER_EXCLUDED_FROM_PAYROLL', 422);
        }
    }

    public function findEmployeeForAccount(User $actor, int $employeeId): User
    {
        $accountId = $actor->getAccountId();

        return User::where(function ($q) use ($accountId) {
            $q->where('owner_id', $accountId)->orWhere('id', $accountId);
        })->findOrFail($employeeId);
    }
}
