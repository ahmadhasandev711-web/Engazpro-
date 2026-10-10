<?php

namespace App\Policies;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class PaymentPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Payment $payment): Response
    {
        if ($user->isOwnerOrAdmin() || $user->isManager()) {
            return Response::allow();
        }

        return $payment->created_by === $user->id
            ? Response::allow()
            : Response::deny('عذراً، لا تملك صلاحية عرض هذا السند المالي');
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function delete(User $user, Payment $payment): Response
    {
        return !$user->isOwnerOrAdmin()
            ? Response::deny('عذراً، لا تملك صلاحية حذف أو إلغاء السندات المالية')
            : Response::allow();
    }
}
