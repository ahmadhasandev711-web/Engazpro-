<?php

namespace App\Policies;

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
        if ($expense->created_by === $user->id) {
            return Response::allow();
        }
        return Response::deny('عذراً، لا تملك صلاحية تعديل هذا المصروف');
    }

    public function delete(User $user, Expense $expense): Response
    {
        return !$user->isOwnerOrAdmin()
            ? Response::deny('عذراً، حذف المصروفات مقتصر على صاحب العمل ومدير النظام')
            : Response::allow();
    }
}
