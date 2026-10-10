<?php

namespace App\Enums;

enum TreasuryTransactionType: string
{
    case DEPOSIT = 'DEPOSIT';
    case WITHDRAWAL = 'WITHDRAWAL';
    case TRANSFER = 'TRANSFER';
    case HANDOVER = 'HANDOVER';

    public function label(): string
    {
        return match ($this) {
            self::DEPOSIT => 'إيداع نقدي',
            self::WITHDRAWAL => 'سحب نقدي',
            self::TRANSFER => 'تحويل بين الخزن',
            self::HANDOVER => 'توريد عهدة / وردية',
        };
    }
}
