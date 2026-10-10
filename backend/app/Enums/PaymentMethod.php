<?php

namespace App\Enums;

enum PaymentMethod: string
{
    case CASH = 'CASH';
    case CARD = 'CARD';
    case INSTAPAY = 'INSTAPAY';
    case VODAFONE_CASH = 'VODAFONE_CASH';
    case TRANSFER = 'TRANSFER';
    case CREDIT = 'CREDIT';
    case SPLIT = 'SPLIT';
    case COURIER_COD = 'COURIER_COD';

    public function label(): string
    {
        return match ($this) {
            self::CASH => 'نقدي (كاش)',
            self::CARD => 'بطاقة (فيزا / شبكة)',
            self::INSTAPAY => 'إنستاباي (InstaPay)',
            self::VODAFONE_CASH => 'فودافون كاش ومحافظ',
            self::TRANSFER => 'تحويل بنكي / محفظة',
            self::CREDIT => 'آجل (على الحساب)',
            self::SPLIT => 'دفع مجزأ (متعدد)',
            self::COURIER_COD => 'تحصيل عبر شركة شحن (COD)',
        };
    }
}
