<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\Response;

class CourierPolicy
{
    public function viewAny(User $user): Response
    {
        return Response::allow();
    }

    public function viewManifest(User $user): Response
    {
        return Response::allow();
    }

    public function settle(User $user): Response
    {
        return ($user->isOwnerOrAdmin() || $user->isManager() || $user->isCashier())
            ? Response::allow()
            : Response::deny('عذراً، تسوية حسابات شركات الشحن مقتصرة على المالك والإدارة ومديري الفروع والكاشير فقط.');
    }
}
