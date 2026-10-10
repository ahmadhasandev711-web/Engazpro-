<?php

namespace App\Enums;

enum StockTransferStatus: string
{
    case PENDING = 'PENDING';
    case IN_TRANSIT = 'IN_TRANSIT';
    case RECEIVED = 'RECEIVED';
    case CANCELLED = 'CANCELLED';

    public function label(): string
    {
        return match ($this) {
            self::PENDING => 'معلق / بانتظار الإرسال',
            self::IN_TRANSIT => 'في الطريق',
            self::RECEIVED => 'تم الاستلام والاعتماد',
            self::CANCELLED => 'ملغي',
        };
    }
}
