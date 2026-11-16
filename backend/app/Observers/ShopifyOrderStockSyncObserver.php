<?php

namespace App\Observers;

use App\Jobs\PushStockToShopifyJob;
use App\Models\ShopifyOrder;
use App\Services\Shopify\ShopifyStockSyncGate;

class ShopifyOrderStockSyncObserver
{
    public function updated(ShopifyOrder $order): void
    {
        if (!$order->wasChanged('status') && !$order->wasChanged('branch_id')) {
            return;
        }

        if (!ShopifyStockSyncGate::isActive($order->user_id)) {
            return;
        }

        $order->loadMissing('items');
        foreach ($order->items as $item) {
            if ($item->product_id) {
                PushStockToShopifyJob::dispatch($order->user_id, $item->product_id, $item->product_variant_id, $order->branch_id)->afterCommit();
            }
        }
    }
}
