<?php

namespace App\Enums;

enum QueueName: string
{
    case WOO_REALTIME = 'woo-realtime';
    case WOO_BULK = 'woo-bulk';
    case DEFAULT = 'default';
}
