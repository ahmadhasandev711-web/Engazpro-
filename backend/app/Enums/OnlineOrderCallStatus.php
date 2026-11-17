<?php

namespace App\Enums;

enum OnlineOrderCallStatus: string
{
    case NO_ANSWER = 'NO_ANSWER';
    case CALLBACK_SCHEDULED = 'CALLBACK_SCHEDULED';
    case CONFIRMED = 'CONFIRMED';

    public function label(): string
    {
        return match ($this) {
            self::NO_ANSWER => 'ما ردّش',
            self::CALLBACK_SCHEDULED => 'مؤجل لموعد متابعة',
            self::CONFIRMED => 'تم التأكيد من الكول سنتر',
        };
    }

    /**
     * @return list<self>
     */
    public static function pendingFollowUpCases(): array
    {
        return [
            self::NO_ANSWER,
            self::CALLBACK_SCHEDULED,
        ];
    }
}
