<?php

namespace App\Services;

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
     * إرجاع حالة اشتراك وتجميد المتجر مع التخزين المؤقت لمدة 60 ثانية
     *
     * @return array{active: bool, frozen: bool, subscription_status: string}
     */
    public static function statusFor(User $user): array
    {
        $ownerId = (int) ($user->owner_id ?: $user->id);

        return Cache::remember(self::cacheKey($ownerId), self::CACHE_TTL, function () use ($ownerId, $user) {
            $owner = ($user->id === $ownerId && !$user->owner_id)
                ? $user
                : User::find($ownerId);

            if (!$owner) {
                return [
                    'active' => false,
                    'frozen' => false,
                    'subscription_status' => 'NONE',
                ];
            }

            $frozen = ($owner->status === UserStatus::INACTIVE);
            $subscription = $owner->subscription;
            $active = !$frozen && (bool) ($subscription && $subscription->isActive());
            $subscriptionStatus = $subscription?->status ?? 'NONE';

            return [
                'active' => $active,
                'frozen' => $frozen,
                'subscription_status' => (string) $subscriptionStatus,
            ];
        });
    }

    /**
     * مسح الكاش فوراً عند تغير حالة المستخدم أو تحديث/حذف الاشتراك
     */
    public static function clear(int $ownerId): void
    {
        Cache::forget(self::cacheKey($ownerId));
    }
}
