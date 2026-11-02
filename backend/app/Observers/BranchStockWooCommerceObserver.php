<?php

namespace App\Observers;

use App\Jobs\PushStockToWooCommerceJob;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Services\WooCommerce\WooStockSyncGate;

class BranchStockWooCommerceObserver
{
    public function saved(BranchStock $branchStock): void
    {
        $userId = Branch::withoutGlobalScopes()->whereKey($branchStock->branch_id)->value('user_id');
        if (!$userId) {
            return;
        }

        if (!WooStockSyncGate::isActive($userId)) {
            return;
        }

        try {
            PushStockToWooCommerceJob::dispatch(
                $userId,
                $branchStock->product_id,
                $branchStock->product_variant_id
            )->afterCommit();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("WooCommerce stock sync dispatch caught: " . $e->getMessage());
        }
    }
}
