<?php

namespace App\Services\Shopify;

use App\Models\ShopifyIntegration;
use Illuminate\Support\Facades\Cache;

class ShopifyStockSyncGate
{
    /** @var array<int, int> */
    private static array $suppressedDepth = [];

    public static function isActive(int $userId): bool
    {
        if ((self::$suppressedDepth[$userId] ?? 0) > 0) {
            return false;
        }

        return Cache::remember("shopify_stock_sync_active_{$userId}", 60, function () use ($userId) {
            return ShopifyIntegration::withoutGlobalScopes()
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->where('auto_sync_stock', true)
                ->exists();
        });
    }

    public static function suppressDuring(int $accountId, callable $callback): mixed
    {
        self::$suppressedDepth[$accountId] = (self::$suppressedDepth[$accountId] ?? 0) + 1;
        try {
            return $callback();
        } finally {
            self::$suppressedDepth[$accountId]--;
            if (self::$suppressedDepth[$accountId] <= 0) {
                unset(self::$suppressedDepth[$accountId]);
            }
        }
    }

    public static function forget(int $userId): void
    {
        Cache::forget("shopify_stock_sync_active_{$userId}");
    }
}
