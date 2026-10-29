<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Exceptions\EmployeeDomainException;
use App\Support\Money;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class EmployeeService
{
    public function __construct(
        protected TreasuryService $treasuryService
    ) {}

    /**
     * استعراض قائمة فريق العمل مع إحصائيات مبيعات وتحصيلات اليوم (خالٍ من N+1)
     */
    public function getEmployeesWithTodayStats(User $user): Collection
    {
        $today = Carbon::today()->toDateString();
        $accountId = $user->getAccountId();

        $query = User::with('branch:id,name,code,type')
            ->where('owner_id', $accountId);

        if ($user->isManager()) {
            $query->where('branch_id', $user->branch_id);
        }

        $employeeList = $query->orderBy('name')->get();

        $employeeIds = $employeeList->pluck('id');

        $dayRange = [$today, $today . ' 23:59:59'];

        // استعلام تجميعي واحد لمبيعات اليوم
        $salesStats = Invoice::selectRaw('created_by, SUM(total) as total_sales, COUNT(*) as invoices_count')
            ->whereIn('created_by', $employeeIds)
            ->where('type', 'SALE')
            ->whereBetween('date', $dayRange)
            ->groupBy('created_by')
            ->get()
            ->keyBy('created_by');

        // استعلام تجميعي واحد لتحصيلات اليوم
        $collectionsStats = Payment::selectRaw('created_by, SUM(amount) as total_collections')
            ->whereIn('created_by', $employeeIds)
            ->where('type', 'RECEIPT')
            ->whereBetween('date', $dayRange)
            ->groupBy('created_by')
            ->get()
            ->keyBy('created_by');

        $isManagement = $user->isOwnerOrAdmin() || $user->isManager();

        return $employeeList->map(function ($emp) use ($salesStats, $collectionsStats, $isManagement) {
            $empSales = $salesStats->get($emp->id);
            $empCollections = $collectionsStats->get($emp->id);

            return [
                'id' => $emp->id,
                'name' => $emp->name,
                'phone' => $emp->phone,
                'email' => $emp->email,
                'branch_id' => $emp->branch_id,
                'branch' => $emp->branch ? [
                    'id' => $emp->branch->id,
                    'name' => $emp->branch->name,
                    'code' => $emp->branch->code,
                    'type' => $emp->branch->type,
                ] : null,
                'role' => $emp->role,
                'status' => $emp->status,
                'base_salary' => Money::of($emp->base_salary ?? 0)->getAmount(),
                'commission_type' => $emp->commission_type?->value ?? ($emp->commission_type ?? 'NONE'),
                'commission_rate' => Money::of($emp->commission_rate ?? 0)->getAmount(),
                'is_eligible_for_payroll' => $emp->isEligibleForPayroll(),
                'created_at' => $emp->created_at->toIso8601String(),
                'today_stats' => $isManagement ? [
                    'sales' => Money::of($empSales->total_sales ?? 0)->getAmount(),
                    'invoices_count' => (int) ($empSales->invoices_count ?? 0),
                    'collections' => Money::of($empCollections->total_collections ?? 0)->getAmount(),
                ] : null,
            ];
        })->values();
    }

    /**
     * إنشاء موظف جديد وتهيئة درج الكاشير أو عهدة المندوب تلقائياً
     */
    public function createEmployee(User $user, array $data): User
    {
        return DB::transaction(function () use ($user, $data) {
            $accountId = $user->getAccountId();

            $employee = User::create([
                'branch_id' => $data['branch_id'] ?? null,
                'name' => $data['name'],
                'phone' => $data['phone'],
                'email' => $data['email'] ?? null,
                'password' => Hash::make($data['password']),
                'base_salary' => $data['base_salary'] ?? 0.00,
                'commission_type' => $data['commission_type'] ?? 'NONE',
                'commission_rate' => $data['commission_rate'] ?? 0.00,
                'status' => UserStatus::ACTIVE,
            ]);
            $employee->owner_id = $accountId;
            $employee->role = $data['role'] instanceof UserRole ? $data['role'] : UserRole::from($data['role']);
            $employee->save();

            // تهيئة درج الكاشير أو عهدة المندوب تلقائياً داخل نفس المعاملة
            if ($employee->isCashier() || $employee->isMandob()) {
                $this->treasuryService->getTreasuryForUser($employee);
            }

            return $employee->load('branch:id,name,code,type');
        });
    }

    /**
     * تعديل بيانات موظف
     */
    public function updateEmployee(User $employee, array $data): User
    {
        return DB::transaction(function () use ($employee, $data) {
            $updateData = [
                'name' => $data['name'],
                'phone' => $data['phone'],
                'email' => $data['email'] ?? null,
                'branch_id' => $data['branch_id'] ?? null,
            ];

            if (isset($data['base_salary'])) {
                $updateData['base_salary'] = $data['base_salary'];
            }
            if (isset($data['commission_type'])) {
                $updateData['commission_type'] = $data['commission_type'];
            }
            if (isset($data['commission_rate'])) {
                $updateData['commission_rate'] = $data['commission_rate'];
            }

            if (!empty($data['password'])) {
                $updateData['password'] = Hash::make($data['password']);
            }

            $employee->update($updateData);
            $employee->role = $data['role'] instanceof UserRole ? $data['role'] : UserRole::from($data['role']);
            $employee->save();

            return $employee->fresh()->load('branch:id,name,code,type');
        });
    }

    /**
     * تفعيل أو تعطيل حساب موظف
     */
    public function toggleStatus(User $employee): User
    {
        $currentStatus = $employee->status instanceof \BackedEnum ? $employee->status->value : (string) $employee->status;
        $isCurrentlyActive = ($currentStatus === 'ACTIVE' || $employee->status === \App\Enums\UserStatus::ACTIVE);
        $newStatus = $isCurrentlyActive ? \App\Enums\UserStatus::INACTIVE : \App\Enums\UserStatus::ACTIVE;

        $employee->status = $newStatus;
        $employee->save();

        if ($newStatus === \App\Enums\UserStatus::INACTIVE) {
            $employee->revokeTokens();
        }

        return $employee;
    }

    /**
     * حذف حساب موظف بشرط عدم وجود فواتير أو سندات مرتبطة به
     */
    public function deleteEmployee(User $employee): void
    {
        $hasInvoices = Invoice::where('created_by', $employee->id)->exists();
        $hasPayments = Payment::where('created_by', $employee->id)->exists();

        if ($hasInvoices || $hasPayments) {
            throw new EmployeeDomainException('لا يمكن حذف الموظف لوجود فواتير أو سندات قبض مسجلة باسمه. يمكنك تعطيل حسابه بدلاً من ذلك.', 'EMPLOYEE_HAS_TRANSACTIONS');
        }

        $employee->delete();
    }
}
