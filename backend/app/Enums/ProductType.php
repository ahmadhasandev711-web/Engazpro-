<?php

namespace App\Enums;

enum ProductType: string
{
    case STANDARD = 'STANDARD';
    case VARIABLE = 'VARIABLE';
    case EXPIRY = 'EXPIRY';

    public function label(): string
    {
        return match ($this) {
            self::STANDARD => 'منتج قياسي',
            self::VARIABLE => 'منتج بمتغيرات (مقاسات وألوان)',
            self::EXPIRY => 'منتج بتاريخ صلاحية وتشغيلات',
        };
    }
}
