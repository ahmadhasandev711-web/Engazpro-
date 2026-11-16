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
        $accountId = $employee->getAccountId();

        // 1. حساب مبيعات الشهر المؤهلة للعمولة
        if ($employee->isManager()) {
            // المدير: مبيعات الفرع المباشرة فقط بدون أوردرات ووكومرس
            $salesQuery = Invoice::where('user_id', $accountId)
                ->where('branch_id', $employee->branch_id)
                ->where('type', InvoiceType::SALE->value)
                ->whereNull('wc_order_id')
                ->whereBetween('date', [$startDate, $endDate]);
        } else {
            // باقي الموظفين: المبيعات الشخصية المسندة للموظف
            $salesQuery = Invoice::where('user_id', $accountId)
                ->where(function ($q) use ($employee) {
                    $q->where('salesperson_id', $employee->id)
                      ->orWhere(function ($sub) use ($employee) {
                          $sub->whereNull('salesperson_id')->where('created_by', $employee->id);
                      });
                })
                ->where('type', InvoiceType::SALE->value)
                ->whereBetween('date', [$startDate, $endDate]);
        }

        $totalSalesAmount = Money::of($salesQuery->sum('total') ?? 0)->getAmount();
        $invoicesCount = (int) $salesQuery->count();

        // 2. حساب العمولة بدقة عبر Money
        $commissionType = $employee->commission_type instanceof CommissionType
            ? $employee->commission_type
            : CommissionType::tryFrom($employee->commission_type ?? '') ?? CommissionType::NONE;

        $commissionRate = Money::of($employee->commission_rate ?? 0)->getAmount();
        $commissionMoney = Money::zero();

        if ($commissionType === CommissionType::PERCENTAGE_OF_SALES && $commissionRate > 0) {
            $commissionMoney = Money::of($totalSalesAmount)->multiply($commissionRate / 100);
        } elseif ($commissionType === CommissionType::FIXED_PER_INVOICE && $commissionRate > 0) {
            $commissionMoney = Money::of($commissionRate)->multiply($invoicesCount);
        }

        // 3. جلب تسويات الشهر (الإضافي، الخصومات، السلف)
        $adjustments = EmployeeAdjustment::where('user_id', $accountId)
            ->where('employee_id', $employee->id)
            ->whereBetween('date', [$startDate, $endDate])
            ->with('creator:id,name')
            ->orderBy('date', 'desc')
            ->get();

        $bonusesTotal = Money::zero();
        $deductionsTotal = Money::zero();

        foreach ($adjustments as $adj) {
            $adjMoney = Money::of($adj->amount);
            if ($adj->type === EmployeeAdjustmentType::BONUS) {
                $bonusesTotal = $bonusesTotal->add($adjMoney);
            } else {
                // DEDUCTION أو ADVANCE
                $deductionsTotal = $deductionsTotal->add($adjMoney);
            }
        }

        // 4. احتساب صافي المستحق
        $baseSalaryMoney = Money::of($employee->base_salary ?? 0);
        $netPayableMoney = $baseSalaryMoney
            ->add($commissionMoney)
            ->add($bonusesTotal)
            ->subtract($deductionsTotal);

        // 5. التحقق مما إذا كان الراتب قد صُرف مسبقاً لهذا الشهر
        $payout = PayrollPayout::where('user_id', $accountId)
            ->where('employee_id', $employee->id)
            ->where('month', $yearMonth)
            ->with(['treasury:id,name,type', 'payer:id,name'])
            ->first();

        return [
            'employee' => [
                'id' => $employee->id,
                'name' => $employee->name,
                'role' => $employee->role,
                'branch_id' => $employee->branch_id,
                'base_salary' => $baseSalaryMoney->getAmount(),
                'commission_type' => $commissionType->value,
                'commission_rate' => $commissionRate,
            ],
            'month' => $yearMonth,
            'is_manager_scope' => $employee->isManager(),
            'total_sales' => $totalSalesAmount,
            'invoices_count' => $invoicesCount,
            'base_salary' => $baseSalaryMoney->getAmount(),
            'commission_amount' => $commissionMoney->getAmount(),
            'total_bonuses' => $bonusesTotal->getAmount(),
            'total_deductions' => $deductionsTotal->getAmount(),
            'net_payable' => max(0, $netPayableMoney->getAmount()),
            'is_paid' => (bool) $payout,
            'payout' => $payout ? [
                'id' => $payout->id,
                'net_paid' => Money::of($payout->net_paid ?? 0)->getAmount(),
                'payment_method' => $payout->payment_method?->value ?? $payout->payment_method,
                'treasury' => $payout->treasury ? [
                    'id' => $payout->treasury->id,
                    'name' => $payout->treasury->name,
                ] : null,
                'paid_at' => $payout->paid_at->toIso8601String(),
                'paid_by_name' => $payout->payer?->name,
                'notes' => $payout->notes,
            ] : null,
            'adjustments' => $adjustments->map(fn($adj) => [
                'id' => $adj->id,
                'type' => $adj->type?->value ?? $adj->type,
                'amount' => Money::of($adj->amount ?? 0)->getAmount(),
                'date' => $adj->date->toDateString(),
                'reason' => $adj->reason,
                'created_by_name' => $adj->creator?->name,
            ]),
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
            // المدير لا يستطيع إدارة راتبه الشخصي
            if ($actor->id === $employee->id) {
                throw new PayrollDomainException('لا يمكنك إدارة أو صرف راتبك الشخصي، يتم صرف راتب المدير بواسطة مالك المنشأة.', 'MANAGER_CANNOT_PAY_SELF', 403);
            }
            // المدير يدير فقط موظفي فرعه
            if ($employee->branch_id !== $actor->branch_id) {
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
