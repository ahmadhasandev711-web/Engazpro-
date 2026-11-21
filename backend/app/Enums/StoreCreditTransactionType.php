<?php

namespace App\Enums;

enum StoreCreditTransactionType: string
{
    case EARNED = 'EARNED';
    case REDEEMED = 'REDEEMED';
    case ADJUSTMENT = 'ADJUSTMENT';

    public function label(): string
    {
        return match ($this) {
            self::EARNED => 'إضافة من استبدال',
            self::REDEEMED => 'استخدام في فاتورة',
            self::ADJUSTMENT => 'تسوية رصيد محفظة',
        };
    }
}
