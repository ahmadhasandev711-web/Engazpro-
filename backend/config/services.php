<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'shopify' => [
        'api_version' => env('SHOPIFY_API_VERSION', '2026-10'),
        'client_id' => env('SHOPIFY_CLIENT_ID'),
        'client_secret' => env('SHOPIFY_CLIENT_SECRET'),
        'scopes' => env(
            'SHOPIFY_SCOPES',
            'read_products,write_products,write_inventory,read_orders,write_orders,read_fulfillments,write_fulfillments,read_locations,read_customers,read_discounts,write_discounts'
        ),
    ],

    'easyorders' => [
        'api_base_url' => env('EASYORDERS_API_BASE_URL', 'https://api.easy-orders.net/api/v1/external-apps'),
        'app_install_url' => env('EASYORDERS_APP_INSTALL_URL', 'https://app.easy-orders.net/#/install-app'),
        'app_icon_url' => env('EASYORDERS_APP_ICON_URL', 'https://easyfy.cloud/assets/img/logo-192.png'),
        'frontend_redirect_url' => env('EASYORDERS_FRONTEND_REDIRECT_URL'),
    ],

];
