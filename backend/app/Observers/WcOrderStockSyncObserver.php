<?php

namespace App\Observers;

use App\Jobs\PushStockToWooCommerceJob;
use App\Models\WcOrder;
use App\Services\WooCommerce\WooStockSyncGate;

class WcOrderStockSyncObserver
{
    public function updated(WcOrder $order): void
    {
        if (!$order->wasChanged('status') && !$order->wasChanged('branch_id')) {
            return;
        }

        if (!WooStockSyncGate::isActive($order->user_id)) {
            return;
        }

        $order->loadMissing('items');

        foreach ($order->items as $item) {
            if (!$item->product_id) {
                continue;
            }

            PushStockToWooCommerceJob::dispatch(
                $order->user_id,
                $item->product_id,
                $item->product_variant_id
            )->afterCommit();
        }
    }
}
