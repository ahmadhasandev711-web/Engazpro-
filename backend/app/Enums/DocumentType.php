<?php

namespace App\Enums;

enum DocumentType: string
{
    case SALE = 'SALE';
    case PURCHASE = 'PURCHASE';
    case SALE_RETURN = 'SALE_RETURN';
    case PURCHASE_RETURN = 'PURCHASE_RETURN';
    case TRANSFER = 'TRANSFER';
    case SHIFT = 'SHIFT';
    case BRANCH = 'BRANCH';

    public function label(): string
    {
        return match ($this) {
            self::SALE => 'فاتورة بيع',
            self::PURCHASE => 'فاتورة شراء',
            self::SALE_RETURN => 'مرتجع بيع',
            self::PURCHASE_RETURN => 'مرتجع شراء',
            self::TRANSFER => 'تحويل مخزني',
            self::SHIFT => 'وردية كاشير',
            self::BRANCH => 'كود فرع',
        };
    }
}
