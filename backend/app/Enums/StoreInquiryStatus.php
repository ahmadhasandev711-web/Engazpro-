<?php

namespace App\Enums;

enum StoreInquiryStatus: string
{
    case NEW = 'NEW';
    case CONTACTED = 'CONTACTED';
    case CONTRACTED = 'CONTRACTED';
    case CLOSED = 'CLOSED';
}
