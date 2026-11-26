<?php

namespace App\Services\EasyOrders;

use App\Enums\WcOrderStatus;

final class EasyOrdersStatusMap
{
    public const DELIVERED = 'delivered';
    public const CANCELED = 'canceled';
    public const PAID = 'paid';

    private const CANCELLED_STATUSES = [
        'canceled',
        'returned',
        'returning_from_delivery',
        'refunded',
        'paid_failed',
    ];

    public static function normalize(?string $status): string
    {
        return strtolower(trim((string) $status));
    }

    public static function isCancelled(?string $status): bool
    {
        return in_array(self::normalize($status), self::CANCELLED_STATUSES, true);
    }

    public static function isPaidOnline(?string $status): bool
    {
        return self::normalize($status) === self::PAID;
    }

    public static function toInternalStatus(?string $status): WcOrderStatus
    {
        return match (self::normalize($status)) {
            'confirmed', 'paid' => WcOrderStatus::CONFIRMED,
            'processing', 'waiting_for_pickup' => WcOrderStatus::PREPARING,
            'in_delivery' => WcOrderStatus::SHIPPED_VIA_COURIER,
            'delivered' => WcOrderStatus::DELIVERED,
            'returned', 'returning_from_delivery' => WcOrderStatus::RETURNED,
            'canceled', 'refunded', 'paid_failed' => WcOrderStatus::CANCELLED,
            default => WcOrderStatus::PENDING_CONFIRMATION,
        };
    }
}
