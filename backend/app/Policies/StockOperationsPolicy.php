<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\Response;

class StockOperationsPolicy
{
    public function viewAlerts(User $user): Response
    {
        return ($user->isOwnerOrAdmin() || $user->isManager())
            ? Response::allow()
            : Response::deny('عذراً، متابعة تنبيهات المخزون وصلاحية الدفعات متاحة للإدارة فقط.');
    }

    public function viewMovements(User $user): Response
    {
        return ($user->isOwnerOrAdmin() || $user->isManager())
            ? Response::allow()
            : Response::deny('عذراً، دفتر حركات المخزون متاح للإدارة فقط.');
    }
}
