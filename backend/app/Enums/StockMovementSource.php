<?php

namespace App\Enums;

enum StockMovementSource: string
{
    case PURCHASE = 'PURCHASE';
    case SALE = 'SALE';
    case PURCHASE_RETURN = 'PURCHASE_RETURN';
    case SALE_RETURN = 'SALE_RETURN';
    case ADJUSTMENT = 'ADJUSTMENT';
    case INITIAL = 'INITIAL';
}
