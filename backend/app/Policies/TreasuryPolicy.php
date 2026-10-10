<?php

namespace App\Policies;

use App\Models\Treasury;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class TreasuryPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Treasury $treasury): Response
    {
        if ($treasury->user_id !== $user->getAccountId()) {
            return Response::deny('غير مصرح لك بالاطلاع على هذه الخزينة');
        }

        // الكاشير والمندوب: لا يريان سوى الخزينة المعينة لهما
        if (($user->isMandob() || $user->isCashier()) && $treasury->assigned_user_id !== $user->id) {
            return Response::deny('غير مصرح لك بالاطلاع على هذه الخزينة');
        }

        // مدير الفرع والمشرف: يريان خزن فرعهما فقط، ومحجوب عنهما البنوك والمسحوبات والخزائن العامة
        if ($user->isManager() || $user->isSupervisor()) {
            $typeVal = $treasury->type instanceof \BackedEnum ? $treasury->type->value : (string) $treasury->type;
            if (in_array($typeVal, ['BANK', 'WALLET', 'OWNER_DRAWINGS'])) {
                return Response::deny('غير مصرح لك بالاطلاع على الحسابات البنكية أو المسحوبات الشخصية');
            }
            if ($treasury->branch_id && $treasury->branch_id !== $user->branch_id) {
                return Response::deny('غير مصرح لك بالاطلاع على خزن فروع أخرى');
            }
        }

        return Response::allow();
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
