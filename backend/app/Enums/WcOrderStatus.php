<?php

namespace App\Enums;

enum WcOrderStatus: string
{
    case PENDING_CONFIRMATION = 'PENDING_CONFIRMATION';
    case CONFIRMED = 'CONFIRMED';
    case PREPARING = 'PREPARING';
    case DISPATCHED = 'DISPATCHED';
    case SHIPPED_VIA_COURIER = 'SHIPPED_VIA_COURIER';
    case DELIVERED = 'DELIVERED';
    case PARTIALLY_DELIVERED = 'PARTIALLY_DELIVERED';
    case RETURNED = 'RETURNED';
    case CANCELLED = 'CANCELLED';

    public function label(): string
    {
        return match ($this) {
            self::PENDING_CONFIRMATION => 'بانتظار التأكيد',
            self::CONFIRMED => 'مؤكد',
            self::PREPARING => 'قيد التجهيز بالمخزن',
            self::DISPATCHED => 'خرج للشحن مع المندوب',
            self::SHIPPED_VIA_COURIER => 'تم الإسناد لشركة شحن',
            self::DELIVERED => 'تم التسليم والتحصيل',
            self::PARTIALLY_DELIVERED => 'تسليم جزئي',
            self::RETURNED => 'مرتجع بالكامل',
            self::CANCELLED => 'ملغي',
        };
    }

    public function canTransitionTo(self $to): bool
    {
        $allowed = match ($this) {
            self::PENDING_CONFIRMATION => [
                self::CONFIRMED,
                self::CANCELLED,
            ],
            self::CONFIRMED => [
                self::PREPARING,
                self::DISPATCHED,
                self::SHIPPED_VIA_COURIER,
                self::CANCELLED,
            ],
            self::PREPARING => [
                self::DISPATCHED,
                self::SHIPPED_VIA_COURIER,
                self::CANCELLED,
            ],
            self::DISPATCHED, self::SHIPPED_VIA_COURIER => [
                self::DELIVERED,
                self::PARTIALLY_DELIVERED,
                self::RETURNED,
            ],
            self::DELIVERED, self::PARTIALLY_DELIVERED, self::RETURNED, self::CANCELLED => [],
        };

        return in_array($to, $allowed, true);
    }
}
