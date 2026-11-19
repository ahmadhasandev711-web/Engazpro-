<?php

namespace App\Policies;

use App\Enums\ShiftStatus;
use App\Models\Expense;
use App\Models\User;
use App\Services\BranchScopeService;
use Illuminate\Auth\Access\Response;

class ExpensePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Expense $expense): Response
    {
        if ($user->hasGlobalBranchAccess()) {
            return Response::allow();
        }

        if ($user->isManager() || $user->isSupervisor()) {
            $branchId = $expense->treasury?->branch_id ?? $expense->creator?->branch_id;
            return app(BranchScopeService::class)->canAccessBranch($user, $branchId)
                ? Response::allow()
                : Response::deny('عذراً، لا تملك صلاحية الاطلاع على مصروفات فروع أخرى');
        }

        return $expense->created_by === $user->id
            ? Response::allow()
            : Response::deny('عذراً، لا تملك صلاحية الاطلاع على هذا المصروف');
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Expense $expense): Response
    {
        if ($user->isOwnerOrAdmin()) {
            return Response::allow();
        }
        if ($this->isLockedClosedShift($expense)) {
            return Response::deny('عذراً، لا يمكن تعديل مصروف تابع لوردية مغلقة إلا بواسطة الإدارة العليا');
        }
        if ($user->isManager() || $user->isSupervisor()) {
            return $this->canAccessExpenseBranch($user, $expense)
                ? Response::allow()
                : Response::deny('عذراً، لا تملك صلاحية تعديل مصروفات فروع أخرى');
        }
        if ($expense->created_by === $user->id) {
            return Response::allow();
        }

        return Response::deny('عذراً، لا تملك صلاحية تعديل هذا المصروف');
    }

    public function delete(User $user, Expense $expense): Response
    {
        if ($user->isOwnerOrAdmin()) {
            return Response::allow();
        }
        if ($this->isLockedClosedShift($expense)) {
            return Response::deny('عذراً، لا يمكن حذف أو إلغاء مصروف تابع لوردية مغلقة إلا بواسطة الإدارة العليا');
        }
        if ($user->isManager() || $user->isSupervisor()) {
            return $this->canAccessExpenseBranch($user, $expense)
                ? Response::allow()
                : Response::deny('عذراً، لا تملك صلاحية حذف مصروفات فروع أخرى');
        }
        if ($user->isCashier() && $expense->created_by === $user->id && $expense->shift_id !== null) {
            return Response::allow();
        }

        return Response::deny('عذراً، حذف المصروفات مقتصر على الإدارة والمشرف أو الكاشير خلال ورديته المفتوحة');
    }

    private function isLockedClosedShift(Expense $expense): bool
    {
        if (!$expense->shift_id || !$expense->shift) {
            return false;
        }
        $status = $expense->shift->status instanceof ShiftStatus
            ? $expense->shift->status
            : ShiftStatus::tryFrom((string) $expense->shift->status);

        return $status !== ShiftStatus::OPEN;
    }

    private function canAccessExpenseBranch(User $user, Expense $expense): bool
    {
        $branchId = $expense->treasury?->branch_id ?? $expense->creator?->branch_id;

        return app(BranchScopeService::class)->canAccessBranch($user, $branchId);
    }
}
