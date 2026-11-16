<?php

namespace App\Enums;

enum QueueName: string
{
    case WOO_REALTIME = 'woo-realtime';
    case WOO_BULK = 'woo-bulk';
    case SHOPIFY_REALTIME = 'shopify-realtime';
    case SHOPIFY_BULK = 'shopify-bulk';
    case DEFAULT = 'default';
}
