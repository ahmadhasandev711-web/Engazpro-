<?php

namespace App\Services\Shopify;

use App\Models\ShopifyIntegration;
use Illuminate\Support\Facades\Cache;

class ShopifyStockSyncGate
{
    public static function isActive(int $userId): bool
    {
        return Cache::remember("shopify_stock_sync_active_{$userId}", 60, function () use ($userId) {
            return ShopifyIntegration::withoutGlobalScopes()
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->where('auto_sync_stock', true)
                ->exists();
        });
    }

    public static function forget(int $userId): void
    {
        Cache::forget("shopify_stock_sync_active_{$userId}");
    }
}
