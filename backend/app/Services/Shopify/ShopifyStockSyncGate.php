<?php

namespace App\Services\Shopify;

use App\Models\ShopifyIntegration;
use App\Services\Concerns\InteractsWithStockSyncGate;

class ShopifyStockSyncGate
{
    use InteractsWithStockSyncGate;

    protected static function cachePrefix(): string
    {
        return 'shopify_stock_sync_active_';
    }

    protected static function integrationModelClass(): string
    {
        return ShopifyIntegration::class;
    }
}
