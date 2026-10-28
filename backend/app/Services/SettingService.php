<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\User;

class SettingService
{
    public const KEY_BUSINESS_NAME = 'business_name';
    public const KEY_STORE_PHONE = 'store_phone';
    public const KEY_STORE_ADDRESS = 'store_address';
    public const KEY_CURRENCY = 'currency';
    public const KEY_MAX_DISCOUNT_PERCENT = 'max_discount_percent';

    /**
     * Retrieve store identity and currency settings for a user's store account
     */
    public function getStoreIdentity(User $user): array
    {
        $accountId = $user->getAccountId();
        $settings = Setting::where('user_id', $accountId)
            ->whereIn('key', [
                self::KEY_BUSINESS_NAME,
                self::KEY_STORE_PHONE,
                self::KEY_STORE_ADDRESS,
                self::KEY_CURRENCY,
            ])
            ->pluck('value', 'key');

        return [
            'business_name' => $settings->get(self::KEY_BUSINESS_NAME) ?: ($user->owner?->name ?? $user->name),
            'store_phone' => $settings->get(self::KEY_STORE_PHONE) ?: ($user->owner?->phone ?? $user->phone),
            'store_address' => $settings->get(self::KEY_STORE_ADDRESS) ?: '',
            'currency' => $settings->get(self::KEY_CURRENCY) ?: 'ج.م',
            'max_discount_percent' => $this->getMaxDiscountPercent($user),
        ];
    }

    /**
     * أقصى نسبة خصم مسموحة لموظفي البيع (الكاشير/المندوب) على مستوى المنشأة.
     * المالك والإدارة ومدترو الفروع متجاوزون لهذا السقف دائماً.
     * القيمة الافتراضية 100 تعني عدم وجود سقف فعلي حتى يحدده المالك.
     */
    public function getMaxDiscountPercent(User $user): float
    {
        $value = Setting::where('user_id', $user->getAccountId())
            ->where('key', self::KEY_MAX_DISCOUNT_PERCENT)
            ->value('value');

        if (!is_string($value) || trim($value) === '') {
            return 100.0;
        }

        return min(100.0, max(0.0, (float) trim($value)));
    }

    /**
     * Update store identity and currency settings
     */
    public function updateStoreIdentity(User $user, array $data): array
    {
        $accountId = $user->getAccountId();
        $allowedKeys = [
            self::KEY_BUSINESS_NAME => $data['business_name'] ?? null,
            self::KEY_STORE_PHONE => $data['store_phone'] ?? null,
            self::KEY_STORE_ADDRESS => $data['store_address'] ?? null,
            self::KEY_CURRENCY => $data['currency'] ?? 'ج.م',
            self::KEY_MAX_DISCOUNT_PERCENT => $data['max_discount_percent'] ?? '100',
        ];

        foreach ($allowedKeys as $key => $val) {
            Setting::updateOrCreate(
                ['user_id' => $accountId, 'key' => $key],
                ['value' => $val !== null ? (string) $val : '']
            );
        }

        return $this->getStoreIdentity($user);
    }
}
