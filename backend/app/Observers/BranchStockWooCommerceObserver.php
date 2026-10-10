<?php

namespace App\Observers;

use App\Jobs\PushStockToWooCommerceJob;
use App\Models\BranchStock;
use App\Models\WooCommerceIntegration;

class BranchStockWooCommerceObserver
{
    public function saved(BranchStock $branchStock): void
    {
        $branch = $branchStock->branch;
        if (!$branch) {
            return;
        }

        // Fast check: avoid queueing if integration doesn't exist or auto_sync_stock is disabled
        $hasActiveStockSync = WooCommerceIntegration::where('user_id', $branch->user_id)
            ->where('is_active', true)
            ->where('auto_sync_stock', true)
            ->exists();

        if (!$hasActiveStockSync) {
            return;
        }

        PushStockToWooCommerceJob::dispatch(
            $branch->user_id,
            $branchStock->product_id,
            $branchStock->product_variant_id
        );
    }
}

