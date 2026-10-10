<?php

namespace App\Enums;

enum LedgerSource: string
{
    case INVOICE = 'INVOICE';
    case PAYMENT = 'PAYMENT';
    case ADJUSTMENT = 'ADJUSTMENT';
    case INITIAL = 'INITIAL';
    case REVERSAL = 'REVERSAL';
    case SHIPPING = 'SHIPPING';
}
