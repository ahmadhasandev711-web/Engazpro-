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
        'auth_throttle_attempts' => 30,
        'auth_throttle_decay_minutes' => 1,
    ],
];
