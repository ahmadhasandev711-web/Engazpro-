<?php

namespace App\Policies;

use App\Models\Category;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class CategoryPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Category $category): bool
    {
        return true;
    }

    public function create(User $user): Response
    {
        return $user->isMandob()
            ? Response::deny('عذراً، المندوب لا يملك صلاحية إضافة تصنيفات')
            : Response::allow();
    }

    public function update(User $user, Category $category): Response
    {
        return $user->isMandob()
            ? Response::deny('عذراً، المندوب لا يملك صلاحية تعديل التصنيفات')
            : Response::allow();
    }

    public function delete(User $user, Category $category): Response
    {
        return $user->isMandob()
            ? Response::deny('عذراً، المندوب لا يملك صلاحية حذف التصنيفات')
            : Response::allow();
    }
}
