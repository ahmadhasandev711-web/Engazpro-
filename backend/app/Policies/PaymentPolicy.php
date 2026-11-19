<?php

namespace App\Policies;

use App\Models\Payment;
use App\Models\User;
use App\Services\BranchScopeService;
use Illuminate\Auth\Access\Response;

class PaymentPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Payment $payment): Response
    {
        if ($user->hasGlobalBranchAccess()) {
            return Response::allow();
        }

        if ($user->isManager() || $user->isSupervisor()) {
            $branchId = $payment->treasury?->branch_id ?? $payment->creator?->branch_id;
            return app(BranchScopeService::class)->canAccessBranch($user, $branchId)
                ? Response::allow()
                : Response::deny('عذراً، لا تملك صلاحية عرض سندات فروع أخرى');
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
