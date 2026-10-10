<?php

namespace App\Enums;

enum PaymentType: string
{
    case PAYMENT = 'PAYMENT';
    case RECEIPT = 'RECEIPT';

    public function label(): string
    {
        return match ($this) {
            self::PAYMENT => 'سند صرف',
            self::RECEIPT => 'سند قبض',
        };
    }

    public function isReceipt(): bool
    {
        return $this === self::RECEIPT;
    }

    public function isPayment(): bool
    {
        return $this === self::PAYMENT;
    }
}