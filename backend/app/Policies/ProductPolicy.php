<?php

namespace App\Policies;

use App\Models\Product;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ProductPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Product $product): bool
    {
        return true;
    }

    public function create(User $user): Response
    {
        return !($user->isOwnerOrAdmin() || $user->isManager())
            ? Response::deny('عذراً، لا تملك صلاحية إضافة أصناف جديدة')
            : Response::allow();
    }

    public function update(User $user, Product $product): Response
    {
        return !($user->isOwnerOrAdmin() || $user->isManager())
            ? Response::deny('عذراً، لا تملك صلاحية تعديل بيانات الأصناف')
            : Response::allow();
    }

    public function delete(User $user, Product $product): Response
    {
        return !$user->isOwnerOrAdmin()
            ? Response::deny('عذراً، لا تملك صلاحية حذف الأصناف')
            : Response::allow();
    }
}
