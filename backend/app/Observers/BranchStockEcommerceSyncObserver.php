<?php

namespace App\Observers;

use App\Enums\EcommercePlatform;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Services\OnlineOrders\StoreOrderAdapterRegistry;

class BranchStockEcommerceSyncObserver
{
    public function saved(BranchStock $branchStock): void
    {
        $userId = Branch::withoutGlobalScopes()->whereKey($branchStock->branch_id)->value('user_id');
        if (!$userId) {
            return;
        }

        $registry = app(StoreOrderAdapterRegistry::class);
        foreach (EcommercePlatform::cases() as $platform) {
            $adapter = $registry->forPlatform($platform);
            if ($adapter->isSyncActive((int) $userId)) {
                $adapter->dispatchStockPush(
                    (int) $userId,
                    (int) $branchStock->product_id,
                    $branchStock->product_variant_id ? (int) $branchStock->product_variant_id : null,
                    (int) $branchStock->branch_id
                );
            }
        }
    }
}
