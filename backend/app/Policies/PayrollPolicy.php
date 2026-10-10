<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\Response;

class PayrollPolicy
{
    public function view(User $user, User $employee): Response
    {
        if ($employee->isOwnerOrAdmin()) {
            return Response::deny('مالك المنشأة ومدير النظام مستثنون من مسير رواتب الموظفين.');
        }

        if ($user->isOwnerOrAdmin()) {
            return $employee->owner_id === $user->getAccountId()
                ? Response::allow()
                : Response::deny('هذا الموظف لا يتبع لمنشأتك.');
        }

        if ($user->isManager()) {
            if ($employee->owner_id !== $user->getAccountId()) {
                return Response::deny('هذا الموظف لا يتبع لمنشأتك.');
            }
            if ($employee->branch_id !== $user->branch_id) {
                return Response::deny('يمكنك استعراض رواتب موظفي فرعك فقط.');
            }
            return Response::allow();
        }

        return Response::deny('عذراً، لا تملك صلاحية الاطلاع على رواتب الموظفين.');
    }

    public function manage(User $user, User $employee): Response
    {
        if ($employee->isOwnerOrAdmin()) {
            return Response::deny('مالك المنشأة ومدير النظام مستثنون من مسير رواتب الموظفين.');
        }

        if ($user->isOwnerOrAdmin()) {
            return $employee->owner_id === $user->getAccountId()
                ? Response::allow()
                : Response::deny('هذا الموظف لا يتبع لمنشأتك.');
        }

        if ($user->isManager()) {
            if ($user->id === $employee->id) {
                return Response::deny('عذراً، لا يمكنك إدارة أو صرف راتبك الشخصي. يتم ذلك بواسطة مالك المنشأة.');
            }
            if ($employee->owner_id !== $user->getAccountId()) {
                return Response::deny('هذا الموظف لا يتبع لمنشأتك.');
            }
            if ($employee->branch_id !== $user->branch_id) {
                return Response::deny('عذراً، يمكنك إدارة وصرف رواتب موظفي فرعك فقط.');
            }
            return Response::allow();
        }

        return Response::deny('عذراً، لا تملك صلاحية إدارة وصرف رواتب الموظفين.');
    }
}
