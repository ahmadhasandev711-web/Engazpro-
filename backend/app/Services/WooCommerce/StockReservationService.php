<?php

namespace App\Services\WooCommerce;

use App\Enums\WcOrderStatus;
use App\Models\WcOrderItem;
use App\Support\Quantity;

class StockReservationService
{
    /**
     * Compute total reserved stock across specified branches in a single aggregated query.
     *
     * @param array<int> $branchIds
     */
    public function reservedQuantity(
        int $accountId,
        int $productId,
        ?int $variantId,
        array $branchIds,
        ?int $excludeWcOrderId = null
    ): Quantity {
        if (empty($branchIds)) {
            return Quantity::zero();
        }

        $reservingStatuses = array_map(
            fn(WcOrderStatus $status) => $status->value,
            WcOrderStatus::reservingCases()
        );

        $query = WcOrderItem::withoutGlobalScopes()
            ->join('wc_orders', 'wc_orders.id', '=', 'wc_order_items.wc_order_id')
            ->where('wc_order_items.user_id', $accountId)
            ->where('wc_orders.user_id', $accountId)
            ->where('wc_order_items.product_id', $productId)
            ->whereIn('wc_orders.branch_id', $branchIds)
            ->whereIn('wc_orders.status', $reservingStatuses);

        if ($variantId !== null) {
            $query->where('wc_order_items.product_variant_id', $variantId);
        } else {
            $query->whereNull('wc_order_items.product_variant_id');
        }

        if ($excludeWcOrderId !== null) {
            $query->where('wc_orders.id', '!=', $excludeWcOrderId);
        }

        $sum = $query->sum('wc_order_items.quantity');

        return Quantity::of($sum ?? 0);
    }
}
