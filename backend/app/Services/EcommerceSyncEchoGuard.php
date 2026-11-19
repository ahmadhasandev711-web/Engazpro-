<?php

namespace App\Services;

use App\Enums\EcommercePlatform;
use App\Services\Shopify\ShopifyStockSyncGate;
use App\Services\WooCommerce\WooStockSyncGate;
use App\Support\Money;
use Illuminate\Support\Facades\Cache;

class EcommerceSyncEchoGuard
{
    /** @var array<int, int> */
    private static array $suppressedDepth = [];

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

    public static function isSuppressed(int $accountId): bool
    {
        return (self::$suppressedDepth[$accountId] ?? 0) > 0
            || WooStockSyncGate::isSuppressed($accountId)
            || ShopifyStockSyncGate::isSuppressed($accountId);
    }

    public static function recordEcho(
        EcommercePlatform $platform,
        string $entity,
        int $accountId,
        string|int $remoteId,
        string $fingerprint
    ): void {
        Cache::put(
            self::echoCacheKey($platform, $entity, $accountId, $remoteId),
            $fingerprint,
            now()->addSeconds(120)
        );
    }

    public static function matchesAndConsumeEcho(
        EcommercePlatform $platform,
        string $entity,
        int $accountId,
        string|int $remoteId,
        string $fingerprint
    ): bool {
        $key = self::echoCacheKey($platform, $entity, $accountId, $remoteId);
        if (Cache::get($key) !== $fingerprint) {
            return false;
        }

        Cache::forget($key);

        return true;
    }

    public static function priceFingerprint(mixed $regularPrice, mixed $salePrice): string
    {
        return Money::of($regularPrice ?? 0)->getCents() . ':' . Money::of($salePrice ?? 0)->getCents();
    }

    public static function couponFingerprint(
        string $code,
        string $discountType,
        mixed $discountValue,
        bool $isActive
    ): string {
        $cleanCode = strtoupper(trim($code));
        $cents = Money::of($discountValue ?? 0)->getCents();
        $activeFlag = $isActive ? '1' : '0';

        return "{$cleanCode}|{$discountType}|{$cents}|{$activeFlag}";
    }

    private static function echoCacheKey(
        EcommercePlatform $platform,
        string $entity,
        int $accountId,
        string|int $remoteId
    ): string {
        return "ecom_echo:{$platform->value}:{$entity}:{$accountId}:{$remoteId}";
    }
}
