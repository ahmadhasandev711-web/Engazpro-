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
    case STORE_ECOMMERCE_TOGGLED = 'STORE_ECOMMERCE_TOGGLED';
    case ADMIN_ACCESS_DENIED = 'ADMIN_ACCESS_DENIED';
    case INQUIRY_UPDATED = 'INQUIRY_UPDATED';
    case INQUIRY_DELETED = 'INQUIRY_DELETED';
    case PRICING_UPDATED = 'PRICING_UPDATED';
    case STORE_IMPERSONATED = 'STORE_IMPERSONATED';
    case STORE_UPDATED = 'STORE_UPDATED';
    case STORE_ECOMMERCE_CONFIGURED = 'STORE_ECOMMERCE_CONFIGURED';
    case STORE_ECOMMERCE_REMOVED = 'STORE_ECOMMERCE_REMOVED';
    case QUEUE_JOB_RETRIED = 'QUEUE_JOB_RETRIED';
    case QUEUE_JOBS_FLUSHED = 'QUEUE_JOBS_FLUSHED';
    case EASYFY_PRODUCT_SAVED = 'EASYFY_PRODUCT_SAVED';
    case EASYFY_ORDER_STATUS_UPDATED = 'EASYFY_ORDER_STATUS_UPDATED';
    case EASYFY_PAYMENT_VERIFIED = 'EASYFY_PAYMENT_VERIFIED';
    case EASYFY_PAYMENT_REJECTED = 'EASYFY_PAYMENT_REJECTED';
    case EASYFY_STOCK_ADJUSTED = 'EASYFY_STOCK_ADJUSTED';
    case EASYFY_COUPON_SAVED = 'EASYFY_COUPON_SAVED';
    case EASYFY_SETTINGS_UPDATED = 'EASYFY_SETTINGS_UPDATED';

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
            self::STORE_ECOMMERCE_TOGGLED => 'تعديل صلاحية المتجر الإلكتروني',
            self::ADMIN_ACCESS_DENIED => 'رفض وصول إداري',
            self::INQUIRY_UPDATED => 'تحديث طلب متجر',
            self::INQUIRY_DELETED => 'حذف طلب متجر',
            self::PRICING_UPDATED => 'تحديث تسعير المنصة',
            self::STORE_IMPERSONATED => 'دخول دعم فني لمتجر',
            self::STORE_UPDATED => 'تعديل بيانات أو باقة متجر',
            self::STORE_ECOMMERCE_CONFIGURED => 'إعداد ربط متجر إلكتروني',
            self::STORE_ECOMMERCE_REMOVED => 'إزالة ربط متجر إلكتروني',
            self::QUEUE_JOB_RETRIED => 'إعادة تشغيل مهمة طابور',
            self::QUEUE_JOBS_FLUSHED => 'تنظيف المهام الفاشلة',
            default => $this->easyfyLabel(),
        };
    }

    private function easyfyLabel(): string
    {
        return match ($this) {
            self::EASYFY_PRODUCT_SAVED => 'حفظ منتج بمتجر Easyfy',
            self::EASYFY_ORDER_STATUS_UPDATED => 'تحديث حالة طلب Easyfy',
            self::EASYFY_PAYMENT_VERIFIED => 'تأكيد تحويل طلب Easyfy',
            self::EASYFY_PAYMENT_REJECTED => 'رفض إثبات تحويل Easyfy',
            self::EASYFY_STOCK_ADJUSTED => 'تعديل مخزون متجر Easyfy',
            self::EASYFY_COUPON_SAVED => 'حفظ كوبون متجر Easyfy',
            self::EASYFY_SETTINGS_UPDATED => 'تحديث إعدادات متجر Easyfy',
            default => $this->value,
        };
    }
}
