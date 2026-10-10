<?php

namespace App\Enums;

enum CommissionType: string
{
    case NONE = 'NONE';
    case PERCENTAGE_OF_SALES = 'PERCENTAGE_OF_SALES';
    case FIXED_PER_INVOICE = 'FIXED_PER_INVOICE';

    public function label(): string
    {
        return match ($this) {
            self::NONE => 'بدون عمولة',
            self::PERCENTAGE_OF_SALES => 'نسبة مئوية من المبيعات',
            self::FIXED_PER_INVOICE => 'مبلغ ثابت لكل فاتورة',
        };
    }
}
