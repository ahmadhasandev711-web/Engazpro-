<?php

namespace App\Enums;

enum OrderCancelReason: string
{
    case CUSTOMER_REJECTED = 'CUSTOMER_REJECTED';
    case WRONG_NUMBER = 'WRONG_NUMBER';
    case DUPLICATE_ORDER = 'DUPLICATE_ORDER';
    case NO_ANSWER = 'NO_ANSWER';
    case OTHER = 'OTHER';

    public function label(): string
    {
        return match ($this) {
            self::CUSTOMER_REJECTED => 'الزبون رفض / ألغى الطلب',
            self::WRONG_NUMBER => 'رقم غلط / تعذر الوصول',
            self::DUPLICATE_ORDER => 'طلب مكرر',
            self::NO_ANSWER => 'لم يرد بعد عدة محاولات',
            self::OTHER => 'سبب آخر',
        };
    }

    public function toShopifyReason(): string
    {
        return match ($this) {
            self::CUSTOMER_REJECTED, self::NO_ANSWER => 'CUSTOMER',
            self::WRONG_NUMBER, self::DUPLICATE_ORDER, self::OTHER => 'OTHER',
        };
    }
}
