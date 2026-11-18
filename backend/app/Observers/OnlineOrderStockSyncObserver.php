<?php

namespace App\Observers;

use App\Enums\EcommercePlatform;
use App\Enums\WcOrderStatus;
use App\Models\OnlineOrder;
use App\Services\Anoofy\AnoofyOutboxService;
use App\Services\OnlineOrders\StoreOrderAdapterRegistry;

class OnlineOrderStockSyncObserver
{
    public function updated(OnlineOrder $order): void
    {
        if (!$order->wasChanged('status') && !$order->wasChanged('branch_id')) {
            return;
        }

        $this->dispatchPlatformStockSync($order);
        $this->recordAnoofyStageIfApplicable($order);
    }

    private function dispatchPlatformStockSync(OnlineOrder $order): void
    {
        $adapter = app(StoreOrderAdapterRegistry::class)->forPlatform($order->platform);
        if (!$adapter->isSyncActive($order->user_id)) {
            return;
        }

        $branchIds = array_values(array_unique(array_filter([
            $order->branch_id,
            $order->wasChanged('branch_id') ? $order->getOriginal('branch_id') : null,
        ])));

        $order->loadMissing('items');
        foreach ($branchIds as $branchId) {
            foreach ($order->items as $item) {
                if ($item->product_id) {
                    $adapter->dispatchStockPush($order->user_id, $item->product_id, $item->product_variant_id, (int) $branchId);
                }
            }
        }
    }

    private function recordAnoofyStageIfApplicable(OnlineOrder $order): void
    {
        if ($order->platform !== EcommercePlatform::WOOCOMMERCE || !$order->wasChanged('status')) {
            return;
        }
        if ($order->status === WcOrderStatus::PENDING_CONFIRMATION) {
            return;
        }

        $original = $order->getOriginal('status');
        $previous = $original instanceof WcOrderStatus
            ? $original
            : ($original !== null ? WcOrderStatus::tryFrom((string) $original) : null);

        app(AnoofyOutboxService::class)->recordStageChange($order, $previous);
    }
}
