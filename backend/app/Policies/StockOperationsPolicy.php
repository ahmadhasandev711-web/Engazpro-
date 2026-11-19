<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\Response;

class StockOperationsPolicy
{
    public function viewAlerts(User $user): Response
    {
        return ($user->isOwnerOrAdmin() || $user->isManager() || $user->isSupervisor())
            ? Response::allow()
            : Response::deny('عذراً، متابعة تنبيهات المخزون وصلاحية الدفعات متاحة للإدارة والمشرفين فقط.');
    }

    public function viewMovements(User $user): Response
    {
        return ($user->isOwnerOrAdmin() || $user->isManager() || $user->isSupervisor())
            ? Response::allow()
            : Response::deny('عذراً، دفتر حركات المخزون متاح للإدارة والمشرفين فقط.');
    }
}
