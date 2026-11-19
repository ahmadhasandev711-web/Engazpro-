<?php

namespace App\Policies;

use App\Models\Treasury;
use App\Models\User;
use App\Services\BranchScopeService;
use Illuminate\Auth\Access\Response;

class TreasuryPolicy
{
    public function viewAny(User $user): Response
    {
        return $user->isSales()
            ? Response::deny('عذراً، استعراض الخزن غير متاح لدور بائع الصالة.')
            : Response::allow();
    }

    public function view(User $user, Treasury $treasury): Response
    {
        return app(BranchScopeService::class)->canAccessTreasury($user, $treasury)
            ? Response::allow()
            : Response::deny('غير مصرح لك بالاطلاع على هذه الخزينة');
    }

    public function viewTransactions(User $user, Treasury $treasury): Response
    {
        return $this->view($user, $treasury);
    }

    public function create(User $user): Response
    {
        if (!$user->isOwnerOrAdmin()) {
            return Response::deny('إضافة الخزن وحسابات البنوك مقتصرة على صاحب العمل ومدير النظام فقط');
        }

        return Response::allow();
    }

    public function update(User $user, Treasury $treasury): Response
    {
        if ($treasury->user_id !== $user->getAccountId()) {
            return Response::deny('غير مصرح لك بتعديل هذه الخزينة');
        }

        if (!$user->isOwnerOrAdmin()) {
            return Response::deny('تعديل الخزن مقتصر على صاحب العمل ومدير النظام');
        }

        return Response::allow();
    }

    public function transfer(User $user): Response
    {
        if (!$user->isOwnerOrAdmin() && !$user->isManager()) {
            return Response::deny('تحويل النقدية اليدوي متاح لصاحب العمل والمدير فقط');
        }

        return Response::allow();
    }
}
