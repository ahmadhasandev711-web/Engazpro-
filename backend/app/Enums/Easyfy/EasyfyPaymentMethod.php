<?php

namespace App\Enums\Easyfy;

enum EasyfyPaymentMethod: string
{
    case CASH_ON_DELIVERY = 'CASH_ON_DELIVERY';
    case INSTAPAY = 'INSTAPAY';
    case VODAFONE_CASH = 'VODAFONE_CASH';

    public function label(): string
    {
        return match ($this) {
            self::CASH_ON_DELIVERY => 'الدفع عند الاستلام',
            self::INSTAPAY => 'تحويل إنستاباي (InstaPay)',
            self::VODAFONE_CASH => 'فودافون كاش (Vodafone Cash)',
        };
    }

    public function requiresTransferProof(): bool
    {
        return $this === self::INSTAPAY || $this === self::VODAFONE_CASH;
    }
}
