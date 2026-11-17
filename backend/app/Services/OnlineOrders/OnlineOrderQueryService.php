<?php

namespace App\Services\OnlineOrders;

use App\Enums\OnlineOrderCallStatus;
use App\Enums\WcOrderStatus;
use App\Models\OnlineOrder;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class OnlineOrderQueryService
{
    private const ORDER_RELATIONS = ['party', 'branch', 'mandob', 'courierParty', 'invoice', 'lastCallAttemptByUser', 'cancelledByUser'];

    public function paginateForUser(User $user, array $filters, int $perPage = 20): LengthAwarePaginator
    {
        $query = $this->scopedBaseQuery($user)->with(self::ORDER_RELATIONS);
        $this->applyFilters($query, $user, $filters);

        if (($filters['status'] ?? null) === OnlineOrderCallStatus::NO_ANSWER->value) {
            $query->orderByRaw('CASE WHEN call_scheduled_at IS NOT NULL THEN 0 ELSE 1 END ASC')
                ->orderBy('call_scheduled_at')
                ->orderByDesc('last_call_attempt_at');
        } else {
            $query->orderByRaw('COALESCE(order_date, created_at) DESC');
        }

        return $query->orderByDesc('id')->paginate(min(max($perPage, 1), 100));
    }

    public function tabCountsForUser(User $user, array $filters): array
    {
        $query = $this->scopedBaseQuery($user);
        $this->applyNonStatusFilters($query, $user, $filters);

        $row = $query->selectRaw(
            'COUNT(*) as total_all, '
            . 'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending_cnt, '
            . 'SUM(CASE WHEN status = ? AND call_status IN (?, ?) THEN 1 ELSE 0 END) as no_answer_cnt, '
            . 'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as confirmed_cnt, '
            . 'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as dispatched_cnt, '
            . 'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as courier_cnt, '
            . 'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as delivered_cnt, '
            . 'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as returned_cnt, '
            . 'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as cancelled_cnt',
            $this->tabCountBindings()
        )->first();

        return $this->formatTabCounts($row);
    }

    public function findForShowOrFail(User $user, int $id): OnlineOrder
    {
        return $this->scopedBaseQuery($user)->with(self::ORDER_RELATIONS)->findOrFail($id);
    }

    public function findForAccountOrFail(User $user, int $id): OnlineOrder
    {
        return OnlineOrder::where('user_id', $user->getAccountId())->findOrFail($id);
    }

    private function scopedBaseQuery(User $user): Builder
    {
        $query = OnlineOrder::where('user_id', $user->getAccountId());

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
        $this->applyNonStatusFilters($query, $user, $filters);
        $status = $filters['status'] ?? null;
        if (empty($status)) {
            return;
        }
        if ($status === OnlineOrderCallStatus::NO_ANSWER->value) {
            $query->where('status', WcOrderStatus::PENDING_CONFIRMATION->value)->whereIn('call_status', array_map(
                fn (OnlineOrderCallStatus $s): string => $s->value,
                OnlineOrderCallStatus::pendingFollowUpCases()
            ));

            return;
        }

        $query->where('status', $status);
    }

    private function applyNonStatusFilters(Builder $query, User $user, array $filters): void
    {
        if (!empty($filters['platform'])) {
            $query->where('platform', $filters['platform']);
        }
        if (!$user->isMandob() && !$user->isManager() && !$user->isCashier() && !$user->isSales() && !empty($filters['mandob_id'])) {
            $query->where('mandob_id', $filters['mandob_id']);
        }
        if (!empty($filters['branch_id']) && !$user->isManager()) {
            $query->where('branch_id', $filters['branch_id']);
        }
        $this->applySearchAndDateFilters($query, $filters);
    }

    /**
     * @return list<string>
     */
    private function tabCountBindings(): array
    {
        return [
            WcOrderStatus::PENDING_CONFIRMATION->value,
            WcOrderStatus::PENDING_CONFIRMATION->value,
            OnlineOrderCallStatus::NO_ANSWER->value,
            OnlineOrderCallStatus::CALLBACK_SCHEDULED->value,
            WcOrderStatus::CONFIRMED->value,
            WcOrderStatus::DISPATCHED->value,
            WcOrderStatus::SHIPPED_VIA_COURIER->value,
            WcOrderStatus::DELIVERED->value,
            WcOrderStatus::RETURNED->value,
            WcOrderStatus::CANCELLED->value,
        ];
    }

    /**
     * @return array<string, int>
     */
    private function formatTabCounts(?object $row): array
    {
        return [
            'ALL' => (int) ($row->total_all ?? 0),
            WcOrderStatus::PENDING_CONFIRMATION->value => (int) ($row->pending_cnt ?? 0),
            OnlineOrderCallStatus::NO_ANSWER->value => (int) ($row->no_answer_cnt ?? 0),
            WcOrderStatus::CONFIRMED->value => (int) ($row->confirmed_cnt ?? 0),
            WcOrderStatus::DISPATCHED->value => (int) ($row->dispatched_cnt ?? 0),
            WcOrderStatus::SHIPPED_VIA_COURIER->value => (int) ($row->courier_cnt ?? 0),
            WcOrderStatus::DELIVERED->value => (int) ($row->delivered_cnt ?? 0),
            WcOrderStatus::RETURNED->value => (int) ($row->returned_cnt ?? 0),
            WcOrderStatus::CANCELLED->value => (int) ($row->cancelled_cnt ?? 0),
        ];
    }

    private function applySearchAndDateFilters(Builder $query, array $filters): void
    {
        if (!empty($filters['search'])) {
            $this->applySearchFilter($query, trim((string) $filters['search']));
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
            $q->where('external_order_id', 'like', "%{$search}%")
                ->orWhere('external_order_number', 'like', "%{$search}%")
                ->orWhere('customer_name', 'like', "%{$search}%")
                ->orWhere('customer_phone', 'like', "%{$search}%")
                ->orWhere('tracking_number', 'like', "%{$search}%")
                ->orWhereHas('party', fn ($sub) => $sub->where('phone', 'like', "%{$search}%")->orWhere('name', 'like', "%{$search}%"));
        });
    }

    private function applyDateBound(Builder $query, string $date, string $operator, string $timeSuffix): void
    {
        $boundary = $date . ' ' . $timeSuffix;
        $query->where(function ($q) use ($operator, $boundary) {
            $q->where('order_date', $operator, $boundary)
                ->orWhere(fn ($sub) => $sub->whereNull('order_date')->where('created_at', $operator, $boundary));
        });
    }
}
