<?php

namespace App\DTOs;

use App\Enums\WcPaymentStatus;
use App\Support\Money;
use Carbon\CarbonInterface;

final readonly class ParsedWcOrder
{
    /**
     * @param list<string> $couponCodes
     * @param list<array<string, mixed>> $rawLineItems
     * @param array<string, mixed> $billing
     * @param array<string, mixed> $shipping
     */
    public function __construct(
        public int $wcOrderId,
        public CarbonInterface $orderDate,
        public string $status,
        public Money $shippingCost,
        public Money $total,
        public Money $discountTotal,
        public Money $subtotal,
        public string $paymentMethod,
        public WcPaymentStatus $paymentStatus,
        public bool $isPaidOnline,
        public ?string $customerName,
        public ?string $customerPhone,
        public ?string $customerEmail,
        public ?string $customerAddress,
        public ?string $governorate,
        public ?string $city,
        public ?string $notes,
        public ?string $trackingNumber,
        public ?string $courierName,
        public array $couponCodes,
        public array $rawLineItems,
        public ?int $customerId,
        public array $billing,
        public array $shipping,
    ) {}
}
