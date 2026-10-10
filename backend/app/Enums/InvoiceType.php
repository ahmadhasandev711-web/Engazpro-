<?php

namespace App\Enums;

enum InvoiceType: string
{
    case SALE = 'SALE';
    case PURCHASE = 'PURCHASE';
    case SALE_RETURN = 'SALE_RETURN';
    case PURCHASE_RETURN = 'PURCHASE_RETURN';

    public function label(): string
    {
        return match ($this) {
            self::SALE => 'فاتورة بيع',
            self::PURCHASE => 'فاتورة شراء',
            self::SALE_RETURN => 'مرتجع بيع',
            self::PURCHASE_RETURN => 'مرتجع شراء',
        };
    }

    public function isSale(): bool
    {
        return $this === self::SALE;
    }

    public function isPurchase(): bool
    {
        return $this === self::PURCHASE;
    }

    public function isReturn(): bool
    {
        return $this === self::SALE_RETURN || $this === self::PURCHASE_RETURN;
    }
}
