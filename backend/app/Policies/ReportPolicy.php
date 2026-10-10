<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\Response;

class ReportPolicy
{
    public function viewProfit(User $user): Response
    {
        return !$user->canViewProfits()
            ? Response::deny('عذراً، تقرير الأرباح متاح لصاحب العمل ومدير النظام فقط')
            : Response::allow();
    }

    public function viewCashFlow(User $user): Response
    {
        return !($user->isOwnerOrAdmin() || $user->isManager())
            ? Response::deny('عذراً، تقرير حركة الخزينة متاح للإدارة فقط')
            : Response::allow();
    }

    public function viewSales(User $user): Response
    {
        return !($user->isOwnerOrAdmin() || $user->isManager())
            ? Response::deny('عذراً، تقرير المبيعات متاح للإدارة فقط')
            : Response::allow();
    }

    public function viewStock(User $user): Response
    {
        return !($user->isOwnerOrAdmin() || $user->isManager())
            ? Response::deny('عذراً، تقرير المخزون متاح للإدارة فقط')
            : Response::allow();
    }
}
