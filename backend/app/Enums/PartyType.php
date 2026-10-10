<?php

namespace App\Enums;

enum PartyType: string
{
    case CUSTOMER = 'CUSTOMER';
    case SUPPLIER = 'SUPPLIER';
    case COURIER = 'COURIER';

    public function label(): string
    {
        return match ($this) {
            self::CUSTOMER => 'عميل',
            self::SUPPLIER => 'مورد',
            self::COURIER => 'شركة شحن',
        };
    }
}
