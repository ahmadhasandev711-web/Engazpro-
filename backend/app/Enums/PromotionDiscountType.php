<?php

namespace App\Enums;

enum PromotionDiscountType: string
{
    case PERCENTAGE = 'PERCENTAGE';
    case FIXED_AMOUNT = 'FIXED_AMOUNT';
}
