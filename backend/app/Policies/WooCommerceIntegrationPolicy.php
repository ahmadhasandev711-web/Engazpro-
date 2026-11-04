<?php

namespace App\Policies;

use App\Models\User;

class WooCommerceIntegrationPolicy
{
    public function manageAnoofy(User $user): bool
    {
        return $user->isOwner();
    }
}
