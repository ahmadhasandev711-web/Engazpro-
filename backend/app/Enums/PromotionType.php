<?php

namespace App\Enums;

enum PromotionType: string
{
    case COUPON = 'COUPON';
    case BUY_X_GET_Y = 'BUY_X_GET_Y';
    case CART_AUTO = 'CART_AUTO';
}
