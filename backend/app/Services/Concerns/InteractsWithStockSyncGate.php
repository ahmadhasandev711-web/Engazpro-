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
        if ((self::$suppressedDepth[$userId] ?? 0) > 0) {
            return false;
        }

        return Cache::remember(static::cachePrefix() . $userId, 60, function () use ($userId) {
            if (!User::withoutGlobalScopes()->whereKey($userId)->where('ecommerce_enabled', true)->exists()) {
                return false;
            }

            $modelClass = static::integrationModelClass();

            return $modelClass::withoutGlobalScopes()
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
        Cache::forget(static::cachePrefix() . $userId);
    }
}
