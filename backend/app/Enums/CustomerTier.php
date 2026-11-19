<?php

namespace App\Enums;

enum CustomerTier: string
{
    case VIP = 'VIP';
    case REPEAT = 'REPEAT';
    case REGULAR = 'REGULAR';
    case HIGH_CANCELLATION = 'HIGH_CANCELLATION';
    case BLACKLISTED = 'BLACKLISTED';

    public function label(): string
    {
        return match ($this) {
            self::VIP => 'عميل مميز VIP',
            self::REPEAT => 'عميل متكرر',
            self::REGULAR => 'عميل عادي',
            self::HIGH_CANCELLATION => 'عالي الإلغاء / مرتجعات',
            self::BLACKLISTED => 'محظور / رافض استلام متكرر',
        };
    }

    public function riskLevel(): CrmRiskLevel
    {
        return match ($this) {
            self::BLACKLISTED => CrmRiskLevel::HIGH,
            self::HIGH_CANCELLATION => CrmRiskLevel::MEDIUM,
            default => CrmRiskLevel::NONE,
        };
    }
}
