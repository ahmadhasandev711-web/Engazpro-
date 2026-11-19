<?php

namespace App\Policies;

use App\Models\Promotion;
use App\Models\User;
use App\Services\BranchScopeService;

class PromotionPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->isOwnerOrAdmin() || $user->isManager();
    }

    public function update(User $user, Promotion $promotion): bool
    {
        return ($user->isOwnerOrAdmin() || $user->isManager())
            && $this->belongsToAccessibleScope($user, $promotion);
    }

    public function delete(User $user, Promotion $promotion): bool
    {
        return $this->update($user, $promotion);
    }

    private function belongsToAccessibleScope(User $user, Promotion $promotion): bool
    {
        if ((int) $promotion->user_id !== $user->getAccountId()) {
            return false;
        }
        if ($user->hasGlobalBranchAccess()) {
            return true;
        }

        return $promotion->branch_id !== null
            && app(BranchScopeService::class)->canAccessBranch($user, $promotion->branch_id);
    }
}
