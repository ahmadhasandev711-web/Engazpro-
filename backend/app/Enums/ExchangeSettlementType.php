<?php

namespace App\Enums;

enum ExchangeSettlementType: string
{
    case EVEN_EXCHANGE = 'EVEN_EXCHANGE';
    case CUSTOMER_PAYS = 'CUSTOMER_PAYS';
    case REFUND_CASH = 'REFUND_CASH';
    case STORE_CREDIT = 'STORE_CREDIT';

    public function label(): string
    {
        return match ($this) {
            self::EVEN_EXCHANGE => 'استبدال متساوي (بدون فرق)',
            self::CUSTOMER_PAYS => 'تحصيل فرق من العميل',
            self::REFUND_CASH => 'رد الفرق للعميل',
            self::STORE_CREDIT => 'ترحيل لمحفظة رصيد المتجر',
        };
    }
}
