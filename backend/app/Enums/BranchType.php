<?php

namespace App\Enums;

enum BranchType: string
{
    case STORE = 'STORE';
    case WAREHOUSE = 'WAREHOUSE';
    case VAN = 'VAN';

    public function label(): string
    {
        return match ($this) {
            self::STORE => 'فرع بيع وتجزئة',
            self::WAREHOUSE => 'مستودع / مخزن رئيسي',
            self::VAN => 'سيارة مندوب / مخزن متنقل',
        };
    }
}
