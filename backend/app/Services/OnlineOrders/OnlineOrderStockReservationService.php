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

    /**
     * Batch-compute reserved quantities per branch/product/variant in a single grouped query (Zero N+1).
     *
     * @param  array<int>  $productIds
     * @param  array<int>  $branchIds
     * @return array<string, float>
     */
    public function reservedMapForProducts(
        int $accountId,
        array $productIds,
        array $branchIds,
        ?int $excludeOrderId = null
    ): array {
        if (empty($productIds) || empty($branchIds)) {
            return [];
        }
        $statuses = array_map(fn (WcOrderStatus $s) => $s->value, WcOrderStatus::reservingCases());
        $rows = OnlineOrderItem::withoutGlobalScopes()
            ->join('online_orders', 'online_orders.id', '=', 'online_order_items.online_order_id')
            ->where('online_order_items.user_id', $accountId)->where('online_orders.user_id', $accountId)
            ->whereIn('online_order_items.product_id', $productIds)->whereIn('online_orders.branch_id', $branchIds)
            ->whereIn('online_orders.status', $statuses)
            ->when($excludeOrderId !== null, fn ($q) => $q->where('online_orders.id', '!=', $excludeOrderId))
            ->groupBy('online_orders.branch_id', 'online_order_items.product_id', 'online_order_items.product_variant_id')
            ->selectRaw('online_orders.branch_id, online_order_items.product_id, COALESCE(online_order_items.product_variant_id, 0) as variant_key, SUM(online_order_items.quantity) as total_qty')
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $map["{$row->branch_id}:{$row->product_id}:{$row->variant_key}"] = Quantity::of($row->total_qty ?? 0)->toFloat();
        }
        return $map;
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
