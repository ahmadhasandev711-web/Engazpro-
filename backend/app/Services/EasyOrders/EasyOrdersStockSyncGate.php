<?php

namespace App\Services\EasyOrders;

use App\Models\EasyOrdersIntegration;
use App\Services\Concerns\InteractsWithStockSyncGate;

class EasyOrdersStockSyncGate
{
    use InteractsWithStockSyncGate;

    protected static function cachePrefix(): string
    {
        return 'easyorders_stock_sync_active_';
    }

    protected static function integrationModelClass(): string
    {
        return EasyOrdersIntegration::class;
    }
}
