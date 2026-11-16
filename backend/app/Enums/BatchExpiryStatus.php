<?php

namespace App\Enums;

enum BatchExpiryStatus: string
{
    case EXPIRED = 'EXPIRED';
    case NEAR_EXPIRY = 'NEAR_EXPIRY';
    case VALID = 'VALID';
}
