<?php

namespace App\Enums;

enum EcommercePlatform: string
{
    case WOOCOMMERCE = 'woocommerce';
    case SHOPIFY = 'shopify';

    public function label(): string
    {
        return match ($this) {
            self::WOOCOMMERCE => 'WooCommerce',
            self::SHOPIFY => 'Shopify',
        };
    }

    public function other(): self
    {
        return match ($this) {
            self::WOOCOMMERCE => self::SHOPIFY,
            self::SHOPIFY => self::WOOCOMMERCE,
        };
    }
}
