<?php

namespace App\Enums;

enum InvoiceReturnStatus: string
{
    case NONE = 'NONE';
    case PARTIAL = 'PARTIAL';
    case FULL = 'FULL';
}
