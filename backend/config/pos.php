<?php

return [
    /*
    |--------------------------------------------------------------------------
    | إعدادات نظام كاشات SaaS (POS Mandob)
    |--------------------------------------------------------------------------
    */

    'trial_days' => (int) env('POS_TRIAL_DAYS', 14),
    'annual_subscription_price' => (float) env('POS_ANNUAL_PRICE', 3000.00),
    'currency' => env('POS_CURRENCY', 'EGP'),

    'pagination' => [
        'default' => 20,
        'max' => 100,
    ],

    'security' => [
        'api_per_minute' => (int) env('POS_API_PER_MINUTE', 300),
        'login_per_minute' => (int) env('POS_LOGIN_PER_MINUTE', 5),
        'webhook_per_minute' => (int) env('POS_WEBHOOK_PER_MINUTE', 600),
    ],

    'queues' => [
        'woo_realtime' => \App\Enums\QueueName::WOO_REALTIME->value,
        'woo_bulk' => \App\Enums\QueueName::WOO_BULK->value,
        'default' => \App\Enums\QueueName::DEFAULT->value,
    ],

    'admin' => [
        'name' => env('ADMIN_NAME', 'مدير النظام'),
        'email' => env('ADMIN_EMAIL'),
        'phone' => env('ADMIN_PHONE'),
        'password' => env('ADMIN_PASSWORD'),
    ],

    // فارغ افتراضياً. مسار الصيانة يرفض أي طلب ما لم يُضبط هذا السر في البيئة.
    'deploy_sync_secret' => env('DEPLOY_SYNC_SECRET'),
];
