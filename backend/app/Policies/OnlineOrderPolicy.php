<?php

namespace App\Policies;

use App\Models\User;
use App\Services\BranchScopeService;
use Illuminate\Auth\Access\Response;
use Illuminate\Database\Eloquent\Model;

class OnlineOrderPolicy
{
    public function manageSettings(User $user): Response
    {
        return $user->isOwnerOrAdmin()
            ? Response::allow()
            : Response::deny('عذراً، إعدادات وربط المتجر الإلكتروني مخصصة لمالك المنشأة ومدير النظام فقط.');
    }

    public function pullOrders(User $user): Response
    {
        return ($user->isOwnerOrAdmin() || $user->isManager())
            ? Response::allow()
            : Response::deny('عذراً، صلاحية سحب وتحديث الطلبات مقتصرة على صاحب المتجر والمدير فقط.');
    }

    public function operateOrder(User $user, ?Model $order = null): Response
    {
        if ($user->isMandob()) {
            return Response::deny('عذراً، هذه العملية على الطلب متاحة للمشرف والكاشير والإدارة فقط.');
        }

        if ($order !== null && $order->branch_id !== null && !app(BranchScopeService::class)->canAccessBranch($user, (int) $order->branch_id)) {
            return Response::deny('عذراً، هذا الطلب تابع لفرع آخر ولا يمكنك التعديل عليه.');
        }

        return Response::allow();
    }

    public function deliverOrder(User $user, Model $order): Response
    {
        if ($user->isMandob() && (int) $order->mandob_id !== (int) $user->id) {
            return Response::deny('عذراً، هذا الطلب غير مسند إليك للتوصيل.');
        }

        if (!$user->isMandob() && $order->branch_id !== null && !app(BranchScopeService::class)->canAccessBranch($user, (int) $order->branch_id)) {
            return Response::deny('عذراً، هذا الطلب تابع لفرع آخر.');
        }

        return Response::allow();
    }
}
