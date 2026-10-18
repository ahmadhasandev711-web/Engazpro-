<?php

namespace App\Enums;

enum UserRole: string
{
    case OWNER = 'OWNER';
    case ADMIN = 'ADMIN';
    case MANAGER = 'MANAGER';
    case SUPERVISOR = 'SUPERVISOR';
    case MANDOB = 'MANDOB';
    case CASHIER = 'CASHIER';
    case SALES = 'SALES';

    public function label(): string
    {
        return match ($this) {
            self::OWNER => 'صاحب العمل',
            self::ADMIN => 'مدير النظام (شريك)',
            self::MANAGER => 'مدير الفرع / المحل',
            self::SUPERVISOR => 'مشرف ورديات واستلام',
            self::MANDOB => 'مندوب مبيعات',
            self::CASHIER => 'كاشير',
            self::SALES => 'بائع صالة / مبيعات',
        };
    }
}
