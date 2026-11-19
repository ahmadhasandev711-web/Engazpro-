<?php

namespace App\Enums;

enum CustomerInteractionChannel: string
{
    case CALL = 'CALL';
    case WHATSAPP = 'WHATSAPP';
    case NOTE = 'NOTE';
    case COMPLAINT = 'COMPLAINT';
    case FOLLOW_UP = 'FOLLOW_UP';

    public function label(): string
    {
        return match ($this) {
            self::CALL => 'مكالمة هاتفية',
            self::WHATSAPP => 'رسالة واتساب',
            self::NOTE => 'ملاحظة داخلية',
            self::COMPLAINT => 'شكوى أو استرجاع',
            self::FOLLOW_UP => 'موعد متابعة',
        };
    }
}
