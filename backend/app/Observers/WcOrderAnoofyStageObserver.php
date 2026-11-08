<?php

namespace App\Observers;

use App\Enums\WcOrderStatus;
use App\Models\WcOrder;
use App\Services\Anoofy\AnoofyOutboxService;

class WcOrderAnoofyStageObserver
{
    public function updated(WcOrder $order): void
    {
        if (!$order->wasChanged('status')) {
            return;
        }

        if ($order->status === WcOrderStatus::PENDING_CONFIRMATION) {
            return;
        }

        $original = $order->getOriginal('status');
        $previousStatus = $original instanceof WcOrderStatus
            ? $original
            : ($original !== null ? WcOrderStatus::tryFrom((string) $original) : null);

        app(AnoofyOutboxService::class)->recordStageChange($order, $previousStatus);
    }
}
