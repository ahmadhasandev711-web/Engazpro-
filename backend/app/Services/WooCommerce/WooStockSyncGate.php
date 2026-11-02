<?php

namespace App\Services\WooCommerce;

use App\Models\WooCommerceIntegration;
use Illuminate\Support\Facades\Cache;

class WooStockSyncGate
{
    public static function isActive(int $userId): bool
    {
        $cacheKey = "wc_stock_sync_active_{$userId}";

        return Cache::remember($cacheKey, 60, function () use ($userId) {
            return WooCommerceIntegration::withoutGlobalScopes()
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->where('auto_sync_stock', true)
                ->exists();
        });
    }

    public static function forget(int $userId): void
    {
        Cache::forget("wc_stock_sync_active_{$userId}");
    }
}
