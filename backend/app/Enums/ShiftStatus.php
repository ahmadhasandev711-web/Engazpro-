<?php

namespace App\Enums;

enum ShiftStatus: string
{
    case OPEN = 'OPEN';
    case CLOSED = 'CLOSED';
    case SETTLED = 'SETTLED';

    public function label(): string
    {
        return match ($this) {
            self::OPEN => 'مفتوحة (قيد العمل)',
            self::CLOSED => 'مقفلة (بانتظار الاستلام)',
            self::SETTLED => 'مستلمة وموردة رسمياً',
        };
    }
}
