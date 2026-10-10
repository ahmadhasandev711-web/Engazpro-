<?php

namespace App\Enums;

enum TreasuryType: string
{
    case MAIN = 'MAIN';
    case BRANCH_SAFE = 'BRANCH_SAFE';
    case CASHIER_DRAWER = 'CASHIER_DRAWER';
    case MANDOB_CUSTODY = 'MANDOB_CUSTODY';
    case BANK = 'BANK';
    case WALLET = 'WALLET';
    case OWNER_DRAWINGS = 'OWNER_DRAWINGS';

    public function label(): string
    {
        return match ($this) {
            self::MAIN => 'الخزينة العامة للمؤسسة',
            self::BRANCH_SAFE => 'خزينة الفرع الرئيسية',
            self::CASHIER_DRAWER => 'درج الكاشير',
            self::MANDOB_CUSTODY => 'عهدة المندوب',
            self::BANK => 'حساب بنكي',
            self::WALLET => 'محفظة إلكترونية مركزية',
            self::OWNER_DRAWINGS => 'مسحوبات شخصية (شركاء)',
        };
    }
}
