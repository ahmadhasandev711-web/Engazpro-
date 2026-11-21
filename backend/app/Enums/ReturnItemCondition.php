<?php

namespace App\Enums;

enum ReturnItemCondition: string
{
    case SELLABLE = 'SELLABLE';
    case DAMAGED = 'DAMAGED';

    public function label(): string
    {
        return match ($this) {
            self::SELLABLE => 'سليم (يعود للمخزون المتاح)',
            self::DAMAGED => 'تالف / عيب تصنيع',
        };
    }
}
