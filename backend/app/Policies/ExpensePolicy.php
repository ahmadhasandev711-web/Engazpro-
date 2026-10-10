<?php

namespace App\Policies;

use App\Models\Expense;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ExpensePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Expense $expense): bool
    {
        return true;
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
