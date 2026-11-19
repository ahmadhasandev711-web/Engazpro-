<?php

namespace App\Policies;

use App\Models\StockTransfer;
use App\Models\User;
use App\Services\BranchScopeService;
use Illuminate\Auth\Access\Response;

class StockTransferPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, StockTransfer $transfer): Response
    {
        if ($transfer->user_id !== $user->getAccountId()) {
            return Response::deny('غير مصرح لك بالوصول لأمر التحويل هذا.');
        }

        $scope = app(BranchScopeService::class);
        if (!$user->hasGlobalBranchAccess()
            && ($scope->shouldFailClosedWithoutBranch($user)
                || (!$scope->canAccessBranch($user, $transfer->from_branch_id) && !$scope->canAccessBranch($user, $transfer->to_branch_id)))) {
            return Response::deny('عذراً، لا تملك صلاحية عرض أوامر تحويل خاصة بفروع أخرى.');
        }

        return Response::allow();
    }

    public function create(User $user): Response
    {
        if ($user->isOwnerOrAdmin() || $user->isManager() || $user->isSupervisor()) {
            return Response::allow();
        }

        return Response::deny('عذراً، صلاحية إنشاء أوامر تحويل المخزون مقتصرة على المالك والإدارة ومديري الفروع والمشرفين فقط.');
    }

    public function receive(User $user, StockTransfer $transfer): Response
    {
        if ($transfer->user_id !== $user->getAccountId()) {
            return Response::deny('غير مصرح لك باستلام أمر التحويل هذا.');
        }

        if ($user->isMandob() || $user->isSales()) {
            return Response::deny('عذراً، استلام تحويلات الفروع غير متاح لهذا الدور.');
        }

        if (!app(BranchScopeService::class)->canAccessBranch($user, $transfer->to_branch_id)) {
            return Response::deny('عذراً، يمكنك فقط تأكيد استلام البضاعة المحولة إلى فرعك.');
        }

        return Response::allow();
    }

    public function cancel(User $user, StockTransfer $transfer): Response
    {
        if ($transfer->user_id !== $user->getAccountId()) {
            return Response::deny('غير مصرح لك بإلغاء أمر التحويل هذا.');
        }

        $scope = app(BranchScopeService::class);
        if (!$user->hasGlobalBranchAccess() && !$scope->canAccessBranch($user, $transfer->from_branch_id) && !$scope->canAccessBranch($user, $transfer->to_branch_id)) {
            return Response::deny('عذراً، لا يمكنك إلغاء أمر تحويل خاص بفروع أخرى.');
        }

        if (!$user->isOwnerOrAdmin() && !$user->isManager() && $transfer->created_by !== $user->id) {
            return Response::deny('عذراً، لا يمكنك إلغاء أمر تحويل لم تقم بإنشائه.');
        }

        return Response::allow();
    }
}
