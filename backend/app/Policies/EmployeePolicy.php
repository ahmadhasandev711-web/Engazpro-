<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\Response;

class EmployeePolicy
{
    public function viewAny(User $user): Response
    {
        return Response::allow();
    }

    public function create(User $user): Response
    {
        return ($user->isOwnerOrAdmin() || $user->isManager())
            ? Response::allow()
            : Response::deny('عذراً، إضافة الموظفين متاحة لصاحب العمل ومدير الفرع فقط');
    }

    public function update(User $user, User $employee): Response
    {
        if ($user->isOwnerOrAdmin()) {
            if ($employee->owner_id !== $user->getAccountId()) {
                return Response::deny('هذا الموظف لا يتبع لمنشأتك');
            }
            return Response::allow();
        }

        if ($user->isManager()) {
            if ($employee->owner_id !== $user->getAccountId()) {
                return Response::deny('هذا الموظف لا يتبع لمنشأتك');
            }
            if ($employee->branch_id !== $user->branch_id) {
                return Response::deny('عذراً، يمكنك تعديل بيانات موظفي فرعك فقط');
            }
            $roleVal = $employee->role instanceof \BackedEnum ? $employee->role->value : (string) $employee->role;
            if (in_array($roleVal, ['OWNER', 'ADMIN', 'MANAGER'])) {
                return Response::deny('عذراً، لا تملك صلاحية تعديل بيانات هذا المستوى الإداري');
            }
            return Response::allow();
        }

        return Response::deny('عذراً، لا تملك صلاحية تعديل بيانات الموظفين');
    }

    public function delete(User $user, User $employee): Response
    {
        if (!$user->isOwnerOrAdmin()) {
            return Response::deny('عذراً، لا تملك صلاحية حذف الموظفين');
        }

        if ($user->isOwner() && $employee->owner_id !== $user->id) {
            return Response::deny('هذا الموظف لا يتبع لمنشأتك');
        }

        return Response::allow();
    }
}
