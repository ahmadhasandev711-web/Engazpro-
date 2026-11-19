<?php

namespace App\Services\Concerns;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

trait InteractsWithStockSyncGate
{
    /** @var array<int, int> */
    private static array $suppressedDepth = [];

    abstract protected static function cachePrefix(): string;

    abstract protected static function integrationModelClass(): string;

    public static function isActive(int $userId): bool
    {
        return self::checkIntegrationFlag($userId, 'auto_sync_stock', '');
    }

    public static function isPriceSyncActive(int $userId): bool
    {
        return self::checkIntegrationFlag($userId, 'auto_sync_prices', 'price_');
    }

    public static function isPromotionSyncActive(int $userId): bool
    {
        return self::checkIntegrationFlag($userId, 'auto_sync_promotions', 'promo_');
    }

    public static function isSuppressed(int $accountId): bool
    {
        return (self::$suppressedDepth[$accountId] ?? 0) > 0;
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
        foreach (['', 'price_', 'promo_'] as $subKey) {
            Cache::forget(static::cachePrefix() . $subKey . $userId);
        }
    }

    private static function checkIntegrationFlag(int $userId, string $flagColumn, string $subKey): bool
    {
        if (self::isSuppressed($userId)) {
            return false;
        }

        return Cache::remember(static::cachePrefix() . $subKey . $userId, 60, function () use ($userId, $flagColumn) {
            if (!User::withoutGlobalScopes()->whereKey($userId)->where('ecommerce_enabled', true)->exists()) {
                return false;
            }

            $modelClass = static::integrationModelClass();

            return $modelClass::withoutGlobalScopes()
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->where($flagColumn, true)
                ->exists();
        });
    }
}
