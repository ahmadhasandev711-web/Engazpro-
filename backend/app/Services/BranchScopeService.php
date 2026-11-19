<?php

namespace App\Services;

use App\Enums\PaymentMethod;
use App\Enums\TreasuryType;
use App\Exceptions\PosDomainException;
use App\Models\Branch;
use App\Models\Treasury;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class BranchScopeService
{
    private const RESTRICTED_TREASURY_TYPES = [
        TreasuryType::MAIN->value,
        TreasuryType::BANK->value,
        TreasuryType::WALLET->value,
        TreasuryType::OWNER_DRAWINGS->value,
    ];

    public function storeHasBranches(int $accountId): bool
    {
        return Branch::where('user_id', $accountId)->exists();
    }

    public function shouldFailClosedWithoutBranch(User $actor): bool
    {
        if ($actor->hasGlobalBranchAccess() || $actor->branch_id !== null) {
            return false;
        }

        return $this->storeHasBranches($actor->getAccountId());
    }

    public function resolveQueryBranchId(User $actor, ?int $requestedBranchId = null): ?int
    {
        if ($actor->hasGlobalBranchAccess()) {
            return $requestedBranchId;
        }

        return $actor->branch_id !== null ? (int) $actor->branch_id : null;
    }

    public function canAccessBranch(User $actor, ?int $targetBranchId): bool
    {
        if ($actor->hasGlobalBranchAccess()) {
            return true;
        }

        if ($this->shouldFailClosedWithoutBranch($actor)) {
            return false;
        }

        if ($actor->branch_id === null || $targetBranchId === null) {
            return true;
        }

        return (int) $actor->branch_id === (int) $targetBranchId;
    }

    public function assertCanAccessBranch(
        User $actor,
        ?int $targetBranchId,
        string $message = 'عذراً، لا تملك صلاحية الوصول إلى بيانات هذا الفرع.'
    ): void {
        if (!$this->canAccessBranch($actor, $targetBranchId)) {
            throw new PosDomainException($message, 'BRANCH_ACCESS_DENIED', 403);
        }
    }

    public function applyBranchFilter(
        Builder $query,
        User $actor,
        string $column = 'branch_id',
        ?int $requestedBranchId = null
    ): Builder {
        if ($this->shouldFailClosedWithoutBranch($actor)) {
            return $query->whereRaw('1 = 0');
        }

        $branchId = $this->resolveQueryBranchId($actor, $requestedBranchId);

        return $branchId !== null ? $query->where($column, $branchId) : $query;
    }

    public function applyTreasuryOrCreatorBranchFilter(
        Builder $query,
        User $actor,
        string $treasuryRelation = 'treasury',
        string $creatorRelation = 'creator',
        ?int $requestedBranchId = null
    ): Builder {
        if ($this->shouldFailClosedWithoutBranch($actor)) {
            return $query->whereRaw('1 = 0');
        }

        $branchId = $this->resolveQueryBranchId($actor, $requestedBranchId);

        return $this->applyDirectBranchIdToTreasuryOrCreator($query, $actor->getAccountId(), $branchId);
    }

    public function applyDirectBranchIdToTreasuryOrCreator(
        Builder $query,
        int $accountId,
        ?int $branchId
    ): Builder {
        if ($branchId === null) {
            return $query;
        }

        $branchTreasuries = Treasury::withoutGlobalScopes()->where('user_id', $accountId)->where('branch_id', $branchId)->select('id');
        $globalTreasuries = Treasury::withoutGlobalScopes()->where('user_id', $accountId)->whereNull('branch_id')->select('id');
        $branchUsers = User::where(fn ($uq) => $uq->where('id', $accountId)->orWhere('owner_id', $accountId))->where('branch_id', $branchId)->select('id');

        return $query->where(fn (Builder $q) => $q
            ->whereIn('treasury_id', $branchTreasuries)
            ->orWhere(fn (Builder $sub) => $sub->whereIn('treasury_id', $globalTreasuries)->whereIn('created_by', $branchUsers)));
    }

    public function canAccessTreasury(User $actor, Treasury $treasury): bool
    {
        if ((int) $treasury->user_id !== $actor->getAccountId()) {
            return false;
        }

        if ($actor->isOwnerOrAdmin()) {
            return true;
        }

        $typeVal = $treasury->type instanceof \BackedEnum ? $treasury->type->value : (string) $treasury->type;
        if (in_array($typeVal, self::RESTRICTED_TREASURY_TYPES, true)) {
            return false;
        }

        if ($actor->isCashier() || $actor->isMandob()) {
            return (int) $treasury->assigned_user_id === (int) $actor->id;
        }

        if ($actor->hasGlobalBranchAccess()) {
            return true;
        }

        if ($this->shouldFailClosedWithoutBranch($actor)) {
            return false;
        }

        return $actor->branch_id === null || (int) $treasury->branch_id === (int) $actor->branch_id;
    }

    public function resolveExpenseTreasury(
        User $actor,
        TreasuryService $treasuryService,
        PaymentMethod $method,
        ?int $requestedTreasuryId
    ): Treasury {
        if ($actor->isOwnerOrAdmin()) {
            return $treasuryService->getTreasuryForPaymentMethod($actor, $method, $requestedTreasuryId);
        }

        if ($method !== PaymentMethod::CASH) {
            return $treasuryService->getTreasuryForPaymentMethod($actor, $method);
        }

        if ($actor->isCashier() || $actor->isMandob()) {
            return $treasuryService->getTreasuryForUser($actor);
        }

        if ($requestedTreasuryId !== null) {
            $explicit = Treasury::findOrFail($requestedTreasuryId);
            if (!$this->canAccessTreasury($actor, $explicit)) {
                throw new PosDomainException('عذراً، لا تملك صلاحية الصرف من هذه الخزينة.', 'TREASURY_FORBIDDEN', 403);
            }

            return $explicit;
        }

        return $treasuryService->getTreasuryForUser($actor);
    }
}
