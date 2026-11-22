<?php

namespace App\Enums\Easyfy;

enum EasyfyOrderStatus: string
{
    case PENDING = 'PENDING';
    case CONFIRMED = 'CONFIRMED';
    case PREPARING = 'PREPARING';
    case SHIPPED = 'SHIPPED';
    case DELIVERED = 'DELIVERED';
    case CANCELLED = 'CANCELLED';

    public function label(): string
    {
        return match ($this) {
            self::PENDING => 'بانتظار التأكيد',
            self::CONFIRMED => 'مؤكد',
            self::PREPARING => 'جاري التجهيز / الطباعة',
            self::SHIPPED => 'تم الشحن',
            self::DELIVERED => 'تم التسليم',
            self::CANCELLED => 'ملغي',
        };
    }

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::PENDING => in_array($next, [self::CONFIRMED, self::PREPARING, self::CANCELLED], true),
            self::CONFIRMED => in_array($next, [self::PREPARING, self::SHIPPED, self::CANCELLED], true),
            self::PREPARING => in_array($next, [self::SHIPPED, self::CANCELLED], true),
            self::SHIPPED => in_array($next, [self::DELIVERED], true),
            self::DELIVERED, self::CANCELLED => false,
        };
    }

    public function isTerminal(): bool
    {
        return $this === self::DELIVERED || $this === self::CANCELLED;
    }
}
