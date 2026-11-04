<?php

namespace App\Enums;

enum AnoofyEventType: string
{
    case CONNECTION_VERIFY = 'connection.verify';
    case ORDER_CONFIRMED = 'order.confirmed';
}
