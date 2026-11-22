<?php

namespace App\Enums\Easyfy;

enum EasyfyStockMovementType: string
{
    case OPENING = 'OPENING';
    case RESTOCK = 'RESTOCK';
    case ORDER_DEDUCTION = 'ORDER_DEDUCTION';
    case ORDER_CANCEL_RESTORE = 'ORDER_CANCEL_RESTORE';
    case ADJUSTMENT = 'ADJUSTMENT';

    public function label(): string
    {
        return match ($this) {
            self::OPENING => 'رصيد افتتاحي',
            self::RESTOCK => 'توريد وإضافة مخزون',
            self::ORDER_DEDUCTION => 'خصم لطلب عميل',
            self::ORDER_CANCEL_RESTORE => 'إرجاع لإلغاء طلب',
            self::ADJUSTMENT => 'تسوية جردية',
        };
    }
}
