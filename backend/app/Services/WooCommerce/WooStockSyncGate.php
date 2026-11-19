<?php

namespace App\Services\WooCommerce;

use App\Models\WooCommerceIntegration;
use App\Services\Concerns\InteractsWithStockSyncGate;

class WooStockSyncGate
{
    use InteractsWithStockSyncGate;

    protected static function cachePrefix(): string
    {
        return 'wc_stock_sync_active_';
    }

    protected static function integrationModelClass(): string
    {
        return WooCommerceIntegration::class;
    }
}
