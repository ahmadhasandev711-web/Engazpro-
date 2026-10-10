<?php

namespace App\Enums;

enum EmployeeAdjustmentType: string
{
    case BONUS = 'BONUS';
    case DEDUCTION = 'DEDUCTION';
    case ADVANCE = 'ADVANCE';

    public function label(): string
    {
        return match ($this) {
            self::BONUS => 'إضافي / مكافأة',
            self::DEDUCTION => 'خصم / جزاء',
            self::ADVANCE => 'سلفة نقدية',
        };
    }
}
