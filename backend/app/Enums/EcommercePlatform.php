<?php

namespace App\Enums;

enum EcommercePlatform: string
{
    case WOOCOMMERCE = 'woocommerce';
    case SHOPIFY = 'shopify';
    case EASYORDERS = 'easyorders';

    public function label(): string
    {
        return match ($this) {
            self::WOOCOMMERCE => 'WooCommerce',
            self::SHOPIFY => 'Shopify',
            self::EASYORDERS => 'EasyOrders',
        };
    }

    /**
     * @return list<self>
     */
    public function others(): array
    {
        return array_values(array_filter(self::cases(), fn (self $c) => $c !== $this));
    }
}
