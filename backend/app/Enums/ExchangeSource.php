<?php

namespace App\Enums;

enum ExchangeSource: string
{
    case POS = 'POS';
    case ONLINE_ORDER = 'ONLINE_ORDER';

    public function label(): string
    {
        return match ($this) {
            self::POS => 'نقطة البيع (الكاشير)',
            self::ONLINE_ORDER => 'طلب متجر إلكتروني',
        };
    }
}
