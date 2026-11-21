<?php

namespace App\Enums;

enum ExchangeStatus: string
{
    case COMPLETED = 'COMPLETED';
    case AWAITING_COURIER_PICKUP = 'AWAITING_COURIER_PICKUP';
    case CANCELLED = 'CANCELLED';

    public function label(): string
    {
        return match ($this) {
            self::COMPLETED => 'مكتمل',
            self::AWAITING_COURIER_PICKUP => 'بانتظار تسليم الشحنة واستلام المرتجع',
            self::CANCELLED => 'ملغي',
        };
    }
}
