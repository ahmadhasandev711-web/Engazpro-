<?php

namespace App\Enums;

enum AdminAuditAction: string
{
    case LICENSES_GENERATED = 'LICENSES_GENERATED';
    case LICENSE_REVOKED = 'LICENSE_REVOKED';
    case LICENSE_REDEEM_FAILED = 'LICENSE_REDEEM_FAILED';
    case SUBSCRIPTION_EXTENDED = 'SUBSCRIPTION_EXTENDED';
    case SUBSCRIPTION_REVOKED = 'SUBSCRIPTION_REVOKED';
    case USER_FROZEN = 'USER_FROZEN';
    case USER_UNFROZEN = 'USER_UNFROZEN';
    case USER_PASSWORD_RESET = 'USER_PASSWORD_RESET';
    case STORE_SESSIONS_REVOKED = 'STORE_SESSIONS_REVOKED';
    case ADMIN_ACCESS_DENIED = 'ADMIN_ACCESS_DENIED';
    case INQUIRY_UPDATED = 'INQUIRY_UPDATED';
    case INQUIRY_DELETED = 'INQUIRY_DELETED';

    public function label(): string
    {
        return match ($this) {
            self::LICENSES_GENERATED => 'توليد أكواد تفعيل',
            self::LICENSE_REVOKED => 'إلغاء كود تفعيل',
            self::LICENSE_REDEEM_FAILED => 'فشل تفعيل كود',
            self::SUBSCRIPTION_EXTENDED => 'تمديد اشتراك',
            self::SUBSCRIPTION_REVOKED => 'إنهاء اشتراك',
            self::USER_FROZEN => 'تجميد متجر',
            self::USER_UNFROZEN => 'تنشيط متجر',
            self::USER_PASSWORD_RESET => 'تغيير كلمة مرور',
            self::STORE_SESSIONS_REVOKED => 'طرد جلسات متجر',
            self::ADMIN_ACCESS_DENIED => 'رفض وصول إداري',
            self::INQUIRY_UPDATED => 'تحديث طلب متجر',
            self::INQUIRY_DELETED => 'حذف طلب متجر',
        };
    }
}
