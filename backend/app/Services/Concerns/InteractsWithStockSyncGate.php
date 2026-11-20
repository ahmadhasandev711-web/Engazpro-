<?php

namespace App\Services\Concerns;

use App\Enums\SubscriptionStatus;
use App\Models\User;
use App\Services\SubscriptionGate;
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

        $gate = self::resolveSubscriptionGate($userId);
        if (empty($gate['active']) || empty($gate['ecommerce_enabled'])) {
            return false;
        }

        return Cache::remember(static::cachePrefix() . $subKey . $userId, 60, function () use ($userId, $flagColumn) {
            $modelClass = static::integrationModelClass();

            return $modelClass::withoutGlobalScopes()
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->where($flagColumn, true)
                ->exists();
        });
    }

    /** @return array{active: bool, frozen: bool, subscription_status: string, ecommerce_enabled: bool} */
    private static function resolveSubscriptionGate(int $userId): array
    {
        $cached = Cache::get(SubscriptionGate::cacheKey($userId));
        if (is_array($cached)) {
            return $cached;
        }

        $owner = User::withoutGlobalScopes()->find($userId);

        return $owner
            ? SubscriptionGate::statusFor($owner)
            : ['active' => false, 'frozen' => false, 'subscription_status' => SubscriptionStatus::NONE->value, 'ecommerce_enabled' => false];
    }
}
