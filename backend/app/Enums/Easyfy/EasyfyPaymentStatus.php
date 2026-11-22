<?php

namespace App\Enums\Easyfy;

enum EasyfyPaymentStatus: string
{
    case NOT_REQUIRED = 'NOT_REQUIRED';
    case PENDING_REVIEW = 'PENDING_REVIEW';
    case VERIFIED = 'VERIFIED';
    case REJECTED = 'REJECTED';

    public function label(): string
    {
        return match ($this) {
            self::NOT_REQUIRED => 'دفع عند الاستلام',
            self::PENDING_REVIEW => 'بانتظار مراجعة التحويل',
            self::VERIFIED => 'تم تأكيد التحويل',
            self::REJECTED => 'تم رفض إثبات التحويل',
        };
    }
}
