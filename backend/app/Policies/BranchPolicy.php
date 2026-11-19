<?php

namespace App\Policies;

use App\Models\Branch;
use App\Models\User;
use App\Services\BranchScopeService;
use Illuminate\Auth\Access\Response;

class BranchPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Branch $branch): Response
    {
        if ($branch->user_id !== $user->getAccountId()) {
            return Response::deny('غير مصرح لك بالوصول لهذا الفرع.');
        }

        if (!app(BranchScopeService::class)->canAccessBranch($user, $branch->id)) {
            return Response::deny('عذراً، لا تملك صلاحية الاطلاع على بيانات فرع آخر.');
        }

        return Response::allow();
    }

    public function create(User $user): Response
    {
        return !$user->isOwnerOrAdmin()
            ? Response::deny('عذراً، لا تمتلك صلاحية إنشاء فروع جديدة. هذه الصلاحية مخصصة لمالك المنشأة فقط.')
            : Response::allow();
    }

    public function update(User $user, Branch $branch): Response
    {
        if ($branch->user_id !== $user->getAccountId()) {
            return Response::deny('غير مصرح لك بالوصول لهذا الفرع.');
        }

        return !$user->isOwnerOrAdmin()
            ? Response::deny('عذراً، صلاحية تعديل بيانات الفرع مخصصة لمالك المنشأة فقط.')
            : Response::allow();
    }

    public function delete(User $user, Branch $branch): Response
    {
        if ($branch->user_id !== $user->getAccountId()) {
            return Response::deny('غير مصرح لك بالوصول لهذا الفرع.');
        }

        return !$user->isOwnerOrAdmin()
            ? Response::deny('عذراً، صلاحية حذف الفروع مخصصة لمالك المنشأة فقط.')
            : Response::allow();
    }

    public function inventory(User $user, Branch $branch): Response
    {
        if ($branch->user_id !== $user->getAccountId()) {
            return Response::deny('غير مصرح لك بالاطلاع على مخزون هذا الفرع.');
        }

        if (!app(BranchScopeService::class)->canAccessBranch($user, $branch->id)) {
            return Response::deny('عذراً، يمكنك الاطلاع على مخزون فرعك المعين فقط.');
        }

        return Response::allow();
    }
}
