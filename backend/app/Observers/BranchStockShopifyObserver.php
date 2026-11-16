<?php

namespace App\Observers;

use App\Jobs\PushStockToShopifyJob;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Services\Shopify\ShopifyStockSyncGate;

class BranchStockShopifyObserver
{
    public function saved(BranchStock $branchStock): void
    {
        $userId = Branch::withoutGlobalScopes()->whereKey($branchStock->branch_id)->value('user_id');
        if (!$userId || !ShopifyStockSyncGate::isActive((int) $userId)) {
            return;
        }

        PushStockToShopifyJob::dispatch(
            (int) $userId,
            $branchStock->product_id,
            $branchStock->product_variant_id,
            $branchStock->branch_id
        )->afterCommit();
    }
}
