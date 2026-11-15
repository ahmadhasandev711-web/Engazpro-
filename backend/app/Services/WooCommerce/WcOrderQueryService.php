<?php

namespace App\Services\WooCommerce;

use App\Models\User;
use App\Models\WcOrder;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class WcOrderQueryService
{
    public function paginateForUser(User $user, array $filters, int $perPage = 20): LengthAwarePaginator
    {
        $query = $this->scopedBaseQuery($user)
            ->with(['party', 'branch', 'mandob', 'courierParty', 'invoice']);

        $this->applyFilters($query, $user, $filters);

        $limit = min(max($perPage, 1), 100);

        return $query
            ->orderByRaw('COALESCE(order_date, created_at) DESC')
            ->orderByDesc('id')
            ->paginate($limit);
    }

    public function findForShowOrFail(User $user, int $id): WcOrder
    {
        return $this->scopedBaseQuery($user)
            ->with(['party', 'branch', 'mandob', 'courierParty', 'invoice'])
            ->findOrFail($id);
    }

    public function findForAccountOrFail(User $user, int $id): WcOrder
    {
        return WcOrder::where('user_id', $user->getAccountId())->findOrFail($id);
    }

    public function findAccountUserOrFail(int $accountId, int $userId): User
    {
        return User::where('owner_id', $accountId)->findOrFail($userId);
    }

    private function scopedBaseQuery(User $user): Builder
    {
        $query = WcOrder::where('user_id', $user->getAccountId());

        if ($user->isMandob()) {
            return $query->where('mandob_id', $user->id);
        }
        if ($user->isManager()) {
            return $user->branch_id ? $query->where('branch_id', $user->branch_id) : $query;
        }
        if ($user->isCashier() || $user->isSales()) {
            return $user->branch_id ? $query->where('branch_id', $user->branch_id) : $query->whereRaw('1 = 0');
        }

        return $query;
    }

    private function applyFilters(Builder $query, User $user, array $filters): void
    {
        if (!$user->isMandob() && !$user->isManager() && !$user->isCashier() && !$user->isSales() && !empty($filters['mandob_id'])) {
            $query->where('mandob_id', $filters['mandob_id']);
        }
        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (!empty($filters['branch_id']) && !$user->isManager()) {
            $query->where('branch_id', $filters['branch_id']);
        }
        if (!empty($filters['search'])) {
            $this->applySearchFilter($query, (string) $filters['search']);
        }
        if (!empty($filters['date_from'])) {
            $this->applyDateBound($query, (string) $filters['date_from'], '>=', '00:00:00');
        }
        if (!empty($filters['date_to'])) {
            $this->applyDateBound($query, (string) $filters['date_to'], '<=', '23:59:59');
        }
    }

    private function applySearchFilter(Builder $query, string $search): void
    {
        $query->where(function ($q) use ($search) {
            $q->where('wc_order_id', 'like', "%{$search}%")
                ->orWhere('customer_name', 'like', "%{$search}%")
                ->orWhere('customer_phone', 'like', "%{$search}%")
                ->orWhereHas('party', function ($sub) use ($search) {
                    $sub->where('phone', 'like', "%{$search}%")
                        ->orWhere('name', 'like', "%{$search}%");
                });
        });
    }

    private function applyDateBound(Builder $query, string $date, string $operator, string $timeSuffix): void
    {
        $boundary = $date . ' ' . $timeSuffix;
        $query->where(function ($q) use ($operator, $boundary) {
            $q->where('order_date', $operator, $boundary)
                ->orWhere(function ($sub) use ($operator, $boundary) {
                    $sub->whereNull('order_date')
                        ->where('created_at', $operator, $boundary);
                });
        });
    }
}
