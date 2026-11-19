<?php

namespace App\Policies;

use App\Enums\PartyType;
use App\Models\Party;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class PartyPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Party $party): bool
    {
        return $party->user_id === $user->getAccountId();
    }

    public function create(User $user, ?string $partyType = null): Response
    {
        if ($partyType === PartyType::SUPPLIER->value && !($user->isOwnerOrAdmin() || $user->isManager())) {
            return Response::deny('عذراً، إضافة الموردين متاحة للمالك والإدارة ومديري الفروع فقط.');
        }
        if ($partyType === PartyType::COURIER->value && ($user->isMandob() || $user->isSales())) {
            return Response::deny('عذراً، لا تملك صلاحية إضافة شركات شحن.');
        }
        return Response::allow();
    }

    public function update(User $user, Party $party): Response
    {
        if ($party->user_id !== $user->getAccountId()) {
            return Response::deny('غير مصرح لك بتعديل جهة التعامل هذه.');
        }
        $partyType = $party->type instanceof \BackedEnum ? $party->type->value : (string) $party->type;
        if (in_array($partyType, [PartyType::SUPPLIER->value, PartyType::COURIER->value], true)
            && !($user->isOwnerOrAdmin() || $user->isManager() || $user->isSupervisor())) {
            return Response::deny('عذراً، تعديل بيانات الموردين وشركات الشحن متاح للمشرف والمدير والإدارة فقط.');
        }
        return Response::allow();
    }

    public function updateTier(User $user, Party $party): Response
    {
        if ($party->user_id !== $user->getAccountId()) {
            return Response::deny('غير مصرح لك بتعديل تصنيف هذه الجهة.');
        }
        return ($user->isOwnerOrAdmin() || $user->isManager() || $user->isSupervisor())
            ? Response::allow()
            : Response::deny('عذراً، تعديل تصنيف العملاء يدوياً متاح للمشرف والمدير والإدارة فقط.');
    }

    public function viewLedger(User $user, Party $party): Response
    {
        if ($party->user_id !== $user->getAccountId()) {
            return Response::deny('غير مصرح لك بعرض كشف حساب هذه الجهة.');
        }
        $partyType = $party->type instanceof \BackedEnum ? $party->type->value : (string) $party->type;
        if ($partyType === PartyType::SUPPLIER->value && !($user->isOwnerOrAdmin() || $user->isManager() || $user->isSupervisor())) {
            return Response::deny('عذراً، كشف حساب الموردين متاح من مستوى المشرف والإدارة فقط.');
        }
        return Response::allow();
    }

    public function delete(User $user, Party $party): Response
    {
        if ($party->user_id !== $user->getAccountId()) {
            return Response::deny('غير مصرح لك بحذف جهة التعامل هذه');
        }

        return !$user->isOwnerOrAdmin()
            ? Response::deny('عذراً، حذف جهات التعامل والشركات مقتصر على صاحب العمل والإدارة فقط')
            : Response::allow();
    }
}
