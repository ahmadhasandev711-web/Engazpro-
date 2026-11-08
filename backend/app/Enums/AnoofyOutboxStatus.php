<?php

namespace App\Enums;

enum AnoofyOutboxStatus: string
{
    case PENDING = 'PENDING';
    case SENT = 'SENT';
    case FAILED = 'FAILED';
}
