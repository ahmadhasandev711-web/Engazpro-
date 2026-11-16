<?php

namespace App\Services\Shopify;

use App\Enums\WcOrderStatus;
use App\Models\ShopifyOrderItem;
use App\Models\WcOrderItem;
use App\Support\Quantity;

class ShopifyStockReservationService
{
    /**
     * @param  array<int>  $branchIds
     */
    public function reservedQuantity(
        int $accountId,
        int $productId,
        ?int $variantId,
        array $branchIds,
        ?int $excludeShopifyOrderId = null
    ): Quantity {
        if (empty($branchIds)) {
            return Quantity::zero();
        }

        $statuses = array_map(fn (WcOrderStatus $s) => $s->value, WcOrderStatus::reservingCases());
        $shopifyReserved = $this->sumShopifyReserved($accountId, $productId, $variantId, $branchIds, $statuses, $excludeShopifyOrderId);
        $wcReserved = $this->sumWcReserved($accountId, $productId, $variantId, $branchIds, $statuses);

        return $shopifyReserved->add($wcReserved);
    }

    private function sumShopifyReserved(int $accountId, int $productId, ?int $variantId, array $branchIds, array $statuses, ?int $excludeId): Quantity
    {
        $query = ShopifyOrderItem::withoutGlobalScopes()
            ->join('shopify_orders', 'shopify_orders.id', '=', 'shopify_order_items.shopify_order_id')
            ->where('shopify_order_items.user_id', $accountId)
            ->where('shopify_orders.user_id', $accountId)
            ->where('shopify_order_items.product_id', $productId)
            ->whereIn('shopify_orders.branch_id', $branchIds)
            ->whereIn('shopify_orders.status', $statuses);

        $variantId !== null
            ? $query->where('shopify_order_items.product_variant_id', $variantId)
            : $query->whereNull('shopify_order_items.product_variant_id');

        if ($excludeId !== null) {
            $query->where('shopify_orders.id', '!=', $excludeId);
        }

        return Quantity::of($query->sum('shopify_order_items.quantity') ?? 0);
    }

    private function sumWcReserved(int $accountId, int $productId, ?int $variantId, array $branchIds, array $statuses): Quantity
    {
        $query = WcOrderItem::withoutGlobalScopes()
            ->join('wc_orders', 'wc_orders.id', '=', 'wc_order_items.wc_order_id')
            ->where('wc_order_items.user_id', $accountId)
            ->where('wc_orders.user_id', $accountId)
            ->where('wc_order_items.product_id', $productId)
            ->whereIn('wc_orders.branch_id', $branchIds)
            ->whereIn('wc_orders.status', $statuses);

        $variantId !== null
            ? $query->where('wc_order_items.product_variant_id', $variantId)
            : $query->whereNull('wc_order_items.product_variant_id');

        return Quantity::of($query->sum('wc_order_items.quantity') ?? 0);
    }
}
