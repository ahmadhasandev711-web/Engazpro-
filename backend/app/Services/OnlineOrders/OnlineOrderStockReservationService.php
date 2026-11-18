<?php

namespace App\Services\OnlineOrders;

use App\Enums\WcOrderStatus;
use App\Models\BranchStock;
use App\Models\OnlineOrderItem;
use App\Support\Quantity;

class OnlineOrderStockReservationService
{
    /**
     * Compute net sellable quantity across branches (physical minus active online reservations).
     *
     * @param  array<int>  $branchIds
     */
    public function netAvailableForBranches(
        int $accountId,
        int $productId,
        ?int $variantId,
        array $branchIds,
        ?int $excludeOrderId = null
    ): Quantity {
        if (empty($branchIds)) {
            return Quantity::zero();
        }

        $query = BranchStock::withoutGlobalScopes()
            ->whereIn('branch_id', $branchIds)
            ->where('product_id', $productId);

        $variantId !== null
            ? $query->where('product_variant_id', $variantId)
            : $query->whereNull('product_variant_id');

        $raw = $query->sum('quantity') ?? 0;
        $reserved = $this->reservedQuantity($accountId, $productId, $variantId, $branchIds, $excludeOrderId);

        return Quantity::of($raw)->subtract($reserved)->maxZero();
    }
    /**
     * Compute total reserved stock across specified branches in one unified query.
     *
     * @param  array<int>  $branchIds
     */
    public function reservedQuantity(
        int $accountId,
        int $productId,
        ?int $variantId,
        array $branchIds,
        ?int $excludeOrderId = null
    ): Quantity {
        if (empty($branchIds)) {
            return Quantity::zero();
        }

        $statuses = array_map(fn (WcOrderStatus $s) => $s->value, WcOrderStatus::reservingCases());

        $query = OnlineOrderItem::withoutGlobalScopes()
            ->join('online_orders', 'online_orders.id', '=', 'online_order_items.online_order_id')
            ->where('online_order_items.user_id', $accountId)
            ->where('online_orders.user_id', $accountId)
            ->where('online_order_items.product_id', $productId)
            ->whereIn('online_orders.branch_id', $branchIds)
            ->whereIn('online_orders.status', $statuses);

        $this->applyOptionalFilters($query, $variantId, $excludeOrderId);

        return Quantity::of($query->sum('online_order_items.quantity') ?? 0);
    }

    private function applyOptionalFilters($query, ?int $variantId, ?int $excludeOrderId): void
    {
        $variantId !== null
            ? $query->where('online_order_items.product_variant_id', $variantId)
            : $query->whereNull('online_order_items.product_variant_id');

        if ($excludeOrderId !== null) {
            $query->where('online_orders.id', '!=', $excludeOrderId);
        }
    }
}
