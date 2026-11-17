<?php

namespace App\DTOs;

use App\Enums\EcommercePlatform;
use App\Enums\WcPaymentStatus;
use App\Support\Money;
use Carbon\CarbonInterface;

final readonly class ParsedOnlineOrder
{
    /**
     * @param  list<string>  $couponCodes
     * @param  list<array<string, mixed>>  $discountBreakdown
     * @param  list<array<string, mixed>>  $rawLineItems
     * @param  array<string, mixed>  $platformMeta
     * @param  array<string, mixed>  $customerContext
     */
    public function __construct(
        public EcommercePlatform $platform,
        public string $externalOrderId,
        public ?string $externalOrderNumber,
        public CarbonInterface $orderDate,
        public bool $isCancelled,
        public Money $shippingCost,
        public Money $subtotal,
        public Money $discountTotal,
        public Money $total,
        public string $paymentMethodLabel,
        public WcPaymentStatus $paymentStatus,
        public ?int $customerId,
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
        public array $discountBreakdown,
        public array $rawLineItems,
        public array $platformMeta = [],
        public array $customerContext = [],
    ) {}
}
