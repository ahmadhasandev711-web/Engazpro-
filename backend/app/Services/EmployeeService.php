<?php

namespace App\Services;

use App\Enums\CommissionType;
use App\Enums\InvoiceType;
use App\Enums\PaymentType;
use App\Enums\ShiftStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Shift;
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
        $dayRange = [Carbon::today()->toDateString(), Carbon::today()->toDateString() . ' 23:59:59'];
        $query = User::with('branch:id,name,code,type')->where('owner_id', $user->getAccountId());
        app(BranchScopeService::class)->applyBranchFilter($query, $user);
        $employeeList = $query->orderBy('name')->get();

        $employeeIds = $employeeList->pluck('id');
        $salesStats = $this->fetchTodaySalesStats($employeeIds, $dayRange);
        $collectionsStats = $this->fetchTodayCollectionStats($employeeIds, $dayRange);
        $isManagement = $user->isOwnerOrAdmin() || $user->isManager();

        return $employeeList->map(fn($emp) => $this->formatEmployeeRow(
            $emp,
            $salesStats->get($emp->id),
            $collectionsStats->get($emp->id),
            $isManagement || $emp->id === $user->id
        ))->values();
    }

    private function fetchTodaySalesStats(Collection $employeeIds, array $dayRange): Collection
    {
        return Invoice::selectRaw('created_by, SUM(total) as total_sales, COUNT(*) as invoices_count')
            ->whereIn('created_by', $employeeIds)
            ->where('type', InvoiceType::SALE->value)
            ->whereBetween('date', $dayRange)
            ->groupBy('created_by')
            ->get()
            ->keyBy('created_by');
    }

    private function fetchTodayCollectionStats(Collection $employeeIds, array $dayRange): Collection
    {
        return Payment::selectRaw('created_by, SUM(amount) as total_collections')
            ->whereIn('created_by', $employeeIds)
            ->where('type', PaymentType::RECEIPT->value)
            ->whereBetween('date', $dayRange)
            ->groupBy('created_by')
            ->get()
            ->keyBy('created_by');
    }

    private function formatEmployeeRow(User $emp, ?object $empSales, ?object $empCollections, bool $isManagement): array
    {
        return [
            'id' => $emp->id,
            'name' => $emp->name,
            'phone' => $emp->phone,
            'email' => $emp->email,
            'branch_id' => $emp->branch_id,
            'branch' => $emp->branch ? ['id' => $emp->branch->id, 'name' => $emp->branch->name, 'code' => $emp->branch->code, 'type' => $emp->branch->type] : null,
            'role' => $emp->role,
            'status' => $emp->status,
            'base_salary' => $isManagement ? Money::of($emp->base_salary ?? 0)->getAmount() : null,
            'commission_type' => $isManagement ? ($emp->commission_type?->value ?? ($emp->commission_type ?? CommissionType::NONE->value)) : null,
            'commission_rate' => $isManagement ? Money::of($emp->commission_rate ?? 0)->getAmount() : null,
            'is_eligible_for_payroll' => $emp->isEligibleForPayroll(),
            'created_at' => $emp->created_at->toIso8601String(),
            'today_stats' => $isManagement ? [
                'sales' => Money::of($empSales->total_sales ?? 0)->getAmount(),
                'invoices_count' => (int) ($empSales->invoices_count ?? 0),
                'collections' => Money::of($empCollections->total_collections ?? 0)->getAmount(),
            ] : null,
        ];
    }

    /**
     * إنشاء موظف جديد وتهيئة درج الكاشير أو عهدة المندوب تلقائياً
     */
    public function createEmployee(User $user, array $data): User
    {
        return DB::transaction(function () use ($user, $data) {
            $accountId = $user->getAccountId();
            $storeCode = (string) (User::whereKey($accountId)->value('store_code') ?? $user->store_code);

            $employee = new User([
                'store_code' => $storeCode,
                'branch_id' => $data['branch_id'] ?? null,
                'name' => $data['name'],
                'phone' => $data['phone'],
                'email' => $data['email'] ?? null,
                'password' => Hash::make($data['password']),
                'base_salary' => $data['base_salary'] ?? 0.00,
                'commission_type' => $data['commission_type'] ?? CommissionType::NONE->value,
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
    public function updateEmployee(User $employee, array $data, ?User $actor = null): User
    {
        return DB::transaction(function () use ($employee, $data, $actor) {
            $oldBranchId = $employee->branch_id ? (int) $employee->branch_id : null;
            $oldRole = $employee->role?->value ?? (string) $employee->role;
            $newBranchId = !empty($data['branch_id']) ? (int) $data['branch_id'] : null;
            $newRoleEnum = $data['role'] instanceof UserRole ? $data['role'] : UserRole::from($data['role']);
            $passwordChanged = !empty($data['password']);

            $this->guardAndSyncBranchTransfer($employee, $oldBranchId, $newBranchId);
            $employee->update($this->extractEmployeeUpdatePayload($data));
            $employee->role = $newRoleEnum;
            $employee->save();

            $this->finalizeEmployeeSecurityState($employee, $oldBranchId !== $newBranchId || $oldRole !== $newRoleEnum->value || $passwordChanged);
            if ($passwordChanged) {
                app(PasswordRecoveryService::class)->resolvePendingRequestsForUser($employee->id, $actor?->id ?? (int) ($employee->owner_id ?: $employee->id));
            }

            return $employee->fresh()->load('branch:id,name,code,type');
        });
    }

    private function guardAndSyncBranchTransfer(User $employee, ?int $oldBranchId, ?int $newBranchId): void
    {
        if ($oldBranchId === $newBranchId) {
            return;
        }

        $hasUnsettledShift = Shift::withoutGlobalScopes()
            ->where('created_by', $employee->id)
            ->whereIn('status', [ShiftStatus::OPEN->value, ShiftStatus::CLOSED->value])
            ->exists();

        if ($hasUnsettledShift) {
            throw new EmployeeDomainException(
                'لا يمكن نقل الموظف إلى فرع آخر قبل تقفيل واعتماد تسوية ورديته الحالية بالفرع السابق.',
                'OPEN_SHIFT_TRANSFER_BLOCKED',
                422
            );
        }

        $employee->assignedTreasury()->update(['branch_id' => $newBranchId]);
    }

    private function finalizeEmployeeSecurityState(User $employee, bool $accessChanged): void
    {
        if ($employee->isCashier() || $employee->isMandob()) {
            $this->treasuryService->getTreasuryForUser($employee);
        }

        if ($accessChanged) {
            $employee->tokens()->delete();
        }
    }

    private function extractEmployeeUpdatePayload(array $data): array
    {
        $updateData = [
            'name' => $data['name'],
            'phone' => $data['phone'],
            'email' => $data['email'] ?? null,
            'branch_id' => $data['branch_id'] ?? null,
        ];
        foreach (['base_salary', 'commission_type', 'commission_rate'] as $field) {
            if (isset($data[$field])) {
                $updateData[$field] = $data[$field];
            }
        }
        if (!empty($data['password'])) {
            $updateData['password'] = Hash::make($data['password']);
        }

        return $updateData;
    }

    /**
     * تفعيل أو تعطيل حساب موظف
     */
    public function toggleStatus(User $employee): User
    {
        $currentStatus = $employee->status instanceof \BackedEnum ? $employee->status->value : (string) $employee->status;
        $isCurrentlyActive = ($currentStatus === UserStatus::ACTIVE->value || $employee->status === UserStatus::ACTIVE);
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
