<?php

namespace App\Enums;

enum AnoofyEventResult: string
{
    case PROCESSED = 'processed';
    case DUPLICATE = 'duplicate';
    case STALE = 'stale';
    case IGNORED = 'ignored';
}
