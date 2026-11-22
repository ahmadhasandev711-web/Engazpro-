<?php

namespace App\Services\Easyfy;

use App\Models\Easyfy\EasyfyOrder;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class EasyfyOrderQueryService
{
    public function paginateForAccount(User $user, array $filters = []): LengthAwarePaginator
    {
        $query = EasyfyOrder::where('account_id', $user->getAccountId())
            ->with(['items', 'shippingZone'])
            ->latest('id');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (!empty($filters['search'])) {
            $q = trim((string) $filters['search']);
            $query->where('order_number', 'like', "%{$q}%");
        }

        return $query->paginate(min(max((int) ($filters['per_page'] ?? 20), 1), 100));
    }

    public function findForAccountOrFail(User $user, int $orderId): EasyfyOrder
    {
        return EasyfyOrder::where('account_id', $user->getAccountId())
            ->with(['items', 'statusHistories', 'shippingZone'])
            ->findOrFail($orderId);
    }

    public function paginateForAdmin(array $filters = []): LengthAwarePaginator
    {
        $query = EasyfyOrder::with(['items', 'shippingZone'])
            ->latest('id');
        $this->applyAdminFilters($query, $filters);

        return $query->paginate(min(max((int) ($filters['per_page'] ?? 25), 1), 100));
    }

    public function findForAdminOrFail(int $orderId): EasyfyOrder
    {
        return EasyfyOrder::with(['items.product', 'items.variant', 'statusHistories', 'shippingZone', 'verifier:id,name'])
            ->findOrFail($orderId);
    }

    public function findOrderItemForAccountOrFail(User $user, int $orderId, int $itemId): \App\Models\Easyfy\EasyfyOrderItem
    {
        $order = $this->findForAccountOrFail($user, $orderId);

        return $order->items()->findOrFail($itemId);
    }

    public function findOrderItemForAdminOrFail(int $orderId, int $itemId): \App\Models\Easyfy\EasyfyOrderItem
    {
        $order = EasyfyOrder::findOrFail($orderId);

        return $order->items()->findOrFail($itemId);
    }

    private function applyAdminFilters(Builder $query, array $filters): void
    {
        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (!empty($filters['payment_verification_status'])) {
            $query->where('payment_verification_status', $filters['payment_verification_status']);
        }
        if (!empty($filters['payment_method'])) {
            $query->where('payment_method', $filters['payment_method']);
        }
        if (!empty($filters['date_from'])) {
            $query->where('created_at', '>=', Carbon::parse($filters['date_from'])->startOfDay());
        }
        if (!empty($filters['date_to'])) {
            $query->where('created_at', '<=', Carbon::parse($filters['date_to'])->endOfDay());
        }
        if (!empty($filters['search'])) {
            $q = trim((string) $filters['search']);
            $query->where(fn (Builder $sub) => $sub->where('order_number', 'like', "%{$q}%")
                ->orWhere('store_name', 'like', "%{$q}%")->orWhere('store_code', 'like', "%{$q}%")
                ->orWhere('owner_phone', 'like', "%{$q}%")->orWhere('ordered_by_phone', 'like', "%{$q}%")
                ->orWhere('recipient_phone', 'like', "%{$q}%"));
        }
    }
}
