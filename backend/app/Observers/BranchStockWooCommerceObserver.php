<?php

namespace App\Observers;

use App\Jobs\PushStockToWooCommerceJob;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\WooCommerceIntegration;
use Illuminate\Support\Facades\Cache;

class BranchStockWooCommerceObserver
{
    public function saved(BranchStock $branchStock): void
    {
        $userId = Branch::whereKey($branchStock->branch_id)->value('user_id');
        if (!$userId) {
            return;
        }

        // Fast check cached for 60 seconds per store to avoid N+1 DB queries on bulk operations
        $cacheKey = "wc_stock_sync_active_{$userId}";
        $hasActiveStockSync = Cache::remember($cacheKey, 60, function () use ($userId) {
            return WooCommerceIntegration::withoutGlobalScopes()
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->where('auto_sync_stock', true)
                ->exists();
        });

        if (!$hasActiveStockSync) {
            return;
        }

        PushStockToWooCommerceJob::dispatch(
            $userId,
            $branchStock->product_id,
            $branchStock->product_variant_id
        )->afterCommit();
    }
}


