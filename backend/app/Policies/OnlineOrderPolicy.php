<?php

namespace App\Policies;

use App\Models\User;
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

    public function operateOrder(User $user): Response
    {
        return !$user->isMandob()
            ? Response::allow()
            : Response::deny('عذراً، هذه العملية على الطلب متاحة للمشرف والكاشير والإدارة فقط.');
    }

    public function deliverOrder(User $user, Model $order): Response
    {
        if ($user->isMandob() && (int) $order->mandob_id !== (int) $user->id) {
            return Response::deny('عذراً، هذا الطلب غير مسند إليك للتوصيل.');
        }

        return Response::allow();
    }
}
