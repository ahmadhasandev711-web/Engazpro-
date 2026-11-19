<?php

namespace App\Enums;

enum PromotionSyncSource: string
{
    case LOCAL = 'POS_LOCAL';
    case WOOCOMMERCE = 'WC_STORE';
    case SHOPIFY = 'SHOPIFY_STORE';
}
