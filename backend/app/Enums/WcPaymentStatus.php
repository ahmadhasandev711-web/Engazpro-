<?php

namespace App\Enums;

enum WcPaymentStatus: string
{
    case PENDING_COD = 'PENDING_COD';
    case PAID_ONLINE = 'PAID_ONLINE';
    case COLLECTED = 'COLLECTED';

    public function label(): string
    {
        return match ($this) {
            self::PENDING_COD => 'دفع عند الاستلام (معلق)',
            self::PAID_ONLINE => 'مدفوع إلكترونياً بالمتجر',
            self::COLLECTED => 'تم تحصيل المبلغ',
        };
    }
}
