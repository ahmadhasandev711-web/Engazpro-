<?php

namespace App\Enums;

enum StockAdjustmentMode: string
{
    case INCREASE = 'INCREASE';
    case DECREASE = 'DECREASE';
    case SET_ACTUAL = 'SET_ACTUAL';

    public function label(): string
    {
        return match ($this) {
            self::INCREASE => 'زيادة رصيد (فائض جرد / إضافي)',
            self::DECREASE => 'خصم رصيد (تالف / هالك / عجز)',
            self::SET_ACTUAL => 'اعتماد الرصيد الفعلي (جرد)',
        };
    }
}
