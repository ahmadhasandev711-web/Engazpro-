<?php

namespace App\Enums\Easyfy;

enum EasyfyStockMode: string
{
    case TRACKED = 'TRACKED';
    case UNLIMITED = 'UNLIMITED';
    case MADE_TO_ORDER = 'MADE_TO_ORDER';

    public function label(): string
    {
        return match ($this) {
            self::TRACKED => 'مخزون فعلي',
            self::UNLIMITED => 'متاح بدون مخزون',
            self::MADE_TO_ORDER => 'تصنيع وطباعة حسب الطلب',
        };
    }
}
