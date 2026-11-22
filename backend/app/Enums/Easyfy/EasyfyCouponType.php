<?php

namespace App\Enums\Easyfy;

enum EasyfyCouponType: string
{
    case PERCENTAGE = 'PERCENTAGE';
    case FIXED = 'FIXED';
    case FREE_SHIPPING = 'FREE_SHIPPING';

    public function label(): string
    {
        return match ($this) {
            self::PERCENTAGE => 'نسبة مئوية (%)',
            self::FIXED => 'خصم ثابت (ج.م)',
            self::FREE_SHIPPING => 'شحن مجاني',
        };
    }
}
