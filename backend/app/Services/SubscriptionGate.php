<?php

namespace App\Services;

use App\Enums\SubscriptionStatus;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

class SubscriptionGate
{
    public const CACHE_TTL = 60; // ثانية

    public static function cacheKey(int $ownerId): string
    {
        return "subscription_gate:owner:{$ownerId}";
    }

    /**
     * إرجاع حالة اشتراك وتجميد المتجر وصلاحية المتجر الإلكتروني مع الكاش 60 ثانية
     *
     * @return array{active: bool, frozen: bool, subscription_status: string, ecommerce_enabled: bool}
     */
    public static function statusFor(User $user): array
    {
        $ownerId = (int) ($user->owner_id ?: $user->id);

        return Cache::remember(self::cacheKey($ownerId), self::CACHE_TTL, function () use ($ownerId, $user) {
            $owner = ($user->id === $ownerId && !$user->owner_id) ? $user : User::find($ownerId);

            return self::resolveStatusPayload($owner);
        });
    }

    /**
     * @return array{active: bool, frozen: bool, subscription_status: string, ecommerce_enabled: bool}
     */
    private static function resolveStatusPayload(?User $owner): array
    {
        if (!$owner) {
            return [
                'active' => false,
                'frozen' => false,
                'subscription_status' => SubscriptionStatus::NONE->value,
                'ecommerce_enabled' => false,
            ];
        }

        $frozen = ($owner->status === UserStatus::INACTIVE);
        $subscription = $owner->subscription;

        return [
            'active' => !$frozen && (bool) ($subscription && $subscription->isActive()),
            'frozen' => $frozen,
            'subscription_status' => $subscription?->status?->value ?? SubscriptionStatus::NONE->value,
            'ecommerce_enabled' => (bool) $owner->ecommerce_enabled,
        ];
    }

    /**
     * مسح الكاش فوراً عند تغير حالة المستخدم أو تحديث/حذف الاشتراك
     */
    public static function clear(int $ownerId): void
    {
        Cache::forget(self::cacheKey($ownerId));
    }
}
