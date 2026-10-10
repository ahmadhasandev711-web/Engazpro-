<?php

namespace App\Policies;

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

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Party $party): bool
    {
        return $party->user_id === $user->getAccountId();
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
