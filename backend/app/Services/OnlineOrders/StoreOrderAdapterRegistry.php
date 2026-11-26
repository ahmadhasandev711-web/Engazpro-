<?php

namespace App\Services\OnlineOrders;

use App\Contracts\StorePlatformOrderAdapterInterface;
use App\Enums\EcommercePlatform;
use App\Exceptions\PosDomainException;
use App\Services\EcommerceAccessService;
use App\Services\OnlineOrders\Adapters\EasyOrdersOrderAdapter;
use App\Services\OnlineOrders\Adapters\ShopifyOrderAdapter;
use App\Services\OnlineOrders\Adapters\WooCommerceOrderAdapter;

class StoreOrderAdapterRegistry
{
    public function __construct(
        private readonly WooCommerceOrderAdapter $woocommerceAdapter,
        private readonly ShopifyOrderAdapter $shopifyAdapter,
        private readonly EasyOrdersOrderAdapter $easyOrdersAdapter,
        private readonly EcommerceAccessService $accessService,
    ) {}

    public function forPlatform(EcommercePlatform $platform): StorePlatformOrderAdapterInterface
    {
        return match ($platform) {
            EcommercePlatform::WOOCOMMERCE => $this->woocommerceAdapter,
            EcommercePlatform::SHOPIFY => $this->shopifyAdapter,
            EcommercePlatform::EASYORDERS => $this->easyOrdersAdapter,
        };
    }

    public function resolveActiveForAccount(int $accountId): StorePlatformOrderAdapterInterface
    {
        $platform = $this->accessService->activePlatformForAccount($accountId);
        if ($platform === null) {
            throw new PosDomainException(
                'لا توجد منصة متجر إلكتروني مفعّلة لهذا الحساب.',
                'ECOMMERCE_PLATFORM_INACTIVE',
                422
            );
        }

        return $this->forPlatform($platform);
    }
}
