<?php

namespace App\Enums;

enum PasswordResetRequestStatus: string
{
    case PENDING = 'PENDING';
    case RESOLVED = 'RESOLVED';
    case DISMISSED = 'DISMISSED';

    public function label(): string
    {
        return match ($this) {
            self::PENDING => 'بانتظار المعالجة',
            self::RESOLVED => 'تمت المعالجة',
            self::DISMISSED => 'تم التجاهل',
        };
    }
}
