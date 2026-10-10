<?php

namespace App\Policies;

use App\Models\StockTransfer;
use App\Models\User;
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

        if ($user->isManager() && $user->branch_id) {
            if ((int) $transfer->from_branch_id !== (int) $user->branch_id && (int) $transfer->to_branch_id !== (int) $user->branch_id) {
                return Response::deny('عذراً، لا تملك صلاحية عرض أوامر تحويل خاصة بفروع أخرى.');
            }
        }

        return Response::allow();
    }

    public function create(User $user): Response
    {
        if ($user->isOwnerOrAdmin() || $user->isManager()) {
            return Response::allow();
        }

        return Response::deny('عذراً، صلاحية إنشاء أوامر تحويل المخزون مقتصرة على المالك والإدارة ومديري الفروع فقط.');
    }

    public function receive(User $user, StockTransfer $transfer): Response
    {
        if ($transfer->user_id !== $user->getAccountId()) {
            return Response::deny('غير مصرح لك باستلام أمر التحويل هذا.');
        }

        if ($user->isManager() && $user->branch_id && (int) $transfer->to_branch_id !== (int) $user->branch_id) {
            return Response::deny('عذراً، يمكنك فقط تأكيد استلام البضاعة المحولة إلى فرعك.');
        }

        return Response::allow();
    }

    public function cancel(User $user, StockTransfer $transfer): Response
    {
        if ($transfer->user_id !== $user->getAccountId()) {
            return Response::deny('غير مصرح لك بإلغاء أمر التحويل هذا.');
        }

        if (!$user->isOwnerOrAdmin() && !$user->isManager() && $transfer->created_by !== $user->id) {
            return Response::deny('عذراً، لا يمكنك إلغاء أمر تحويل لم تقم بإنشائه.');
        }

        return Response::allow();
    }
}
