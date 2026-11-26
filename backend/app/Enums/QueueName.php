<?php

namespace App\Enums;

enum QueueName: string
{
    case WOO_REALTIME = 'woo-realtime';
    case WOO_BULK = 'woo-bulk';
    case SHOPIFY_REALTIME = 'shopify-realtime';
    case SHOPIFY_BULK = 'shopify-bulk';
    case EASYORDERS_REALTIME = 'easyorders-realtime';
    case EASYORDERS_BULK = 'easyorders-bulk';
    case DEFAULT = 'default';
}
