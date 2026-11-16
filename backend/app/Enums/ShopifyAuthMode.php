<?php

namespace App\Enums;

enum ShopifyAuthMode: string
{
    case ACCESS_TOKEN = 'ACCESS_TOKEN';
    case CLIENT_CREDENTIALS = 'CLIENT_CREDENTIALS';
    case OAUTH = 'OAUTH';

    public function label(): string
    {
        return match ($this) {
            self::ACCESS_TOKEN => 'رمز وصول مباشر (Access Token)',
            self::CLIENT_CREDENTIALS => 'بيانات تطبيق Dev Dashboard (Client Credentials)',
            self::OAUTH => 'ربط OAuth 2.0 التلقائي',
        };
    }
}
