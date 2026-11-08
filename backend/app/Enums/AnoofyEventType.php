<?php

namespace App\Enums;

enum AnoofyEventType: string
{
    case CONNECTION_VERIFY = 'connection.verify';
    case ORDER_CONFIRMED = 'order.confirmed';
    case ORDER_STAGE_CHANGED = 'order.stage_changed';

    public function isInbound(): bool
    {
        return $this !== self::ORDER_STAGE_CHANGED;
    }
}
