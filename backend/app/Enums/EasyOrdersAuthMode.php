<?php

namespace App\Enums;

enum EasyOrdersAuthMode: string
{
    case AUTHORIZED_APP = 'AUTHORIZED_APP';
    case API_KEY = 'API_KEY';

    public function label(): string
    {
        return match ($this) {
            self::AUTHORIZED_APP => 'الربط السريع (Authorized App)',
            self::API_KEY => 'مفتاح API اليدوي',
        };
    }
}
