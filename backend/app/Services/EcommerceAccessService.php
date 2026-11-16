<?php

namespace App\Services;

use App\Enums\EcommercePlatform;
use App\Exceptions\PosDomainException;
use App\Models\ShopifyIntegration;
use App\Models\User;
use App\Models\WooCommerceIntegration;

class EcommerceAccessService
{
    public function isEnabledForAccount(int $accountId): bool
    {
        return (bool) User::withoutGlobalScopes()
            ->whereKey($accountId)
            ->value('ecommerce_enabled');
    }

    public function activePlatformForAccount(int $accountId): ?EcommercePlatform
    {
        $wcActive = WooCommerceIntegration::withoutGlobalScopes()
            ->where('user_id', $accountId)
            ->where('is_active', true)
            ->exists();

        if ($wcActive) {
            return EcommercePlatform::WOOCOMMERCE;
        }

        $shopifyActive = ShopifyIntegration::withoutGlobalScopes()
            ->where('user_id', $accountId)
            ->where('is_active', true)
            ->exists();

        return $shopifyActive ? EcommercePlatform::SHOPIFY : null;
    }

    public function assertAddonEnabled(int $accountId): void
    {
        if (!$this->isEnabledForAccount($accountId)) {
            throw new PosDomainException(
                'ميزة ربط المتجر الإلكتروني غير مفعّلة في باقتك الحالية. يرجى التواصل مع إدارة المنصة لتفعيلها.',
                'ECOMMERCE_ADDON_DISABLED',
                403
            );
        }
    }

    public function assertPlatformAllowed(int $accountId, EcommercePlatform $target): void
    {
        $this->assertAddonEnabled($accountId);

        $activePlatform = $this->activePlatformForAccount($accountId);
        if ($activePlatform !== null && $activePlatform !== $target) {
            throw new PosDomainException(
                "متجر {$activePlatform->label()} مربوط ومفعّل بالفعل. يدعم النظام منصة متجر إلكتروني واحدة فقط؛ يرجى إيقاف تفعيل {$activePlatform->label()} أولاً.",
                'ECOMMERCE_PLATFORM_CONFLICT',
                422
            );
        }
    }
}
