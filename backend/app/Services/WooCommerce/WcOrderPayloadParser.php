<?php

namespace App\Services\WooCommerce;

use App\DTOs\ParsedWcOrder;
use App\Enums\WcPaymentStatus;
use App\Support\Money;
use Carbon\Carbon;
use Carbon\CarbonInterface;

class WcOrderPayloadParser
{
    private const ONLINE_GATEWAYS = [
        'stripe',
        'paymob',
        'fawry',
        'credit_card',
        'visa',
        'wallet',
        'card',
        'accept',
        'kashier',
    ];

    private const TRACKING_META_KEYS = [
        '_bosta_tracking_number',
        '_bosta_delivery_id',
        'bosta_tracking_number',
        '_tracking_number',
        'tracking_number',
        '_shipping_tracking_number',
        '_carrier_tracking_no',
    ];

    private const PHONE_META_KEYS = [
        '_billing_phone',
        'billing_phone',
        'phone',
        'mobile',
        '_shipping_phone',
        'shipping_phone',
        'billing_mobile',
        'whatsapp',
        'customer_phone',
    ];

    public function parse(array $data): ParsedWcOrder
    {
        $billing = (array) ($data['billing'] ?? []);
        $shipping = (array) ($data['shipping'] ?? []);
        $meta = (array) ($data['meta_data'] ?? []);

        [$addr, $city, $state] = $this->extractAddress($billing, $shipping);
        [$tracking, $courier] = $this->extractTracking($meta);
        $method = (string) ($data['payment_method'] ?? 'cod');
        [$paidOnline, $payStatus] = $this->determinePayment($data, $method);
        [$shipCost, $total, $discTotal, $subtotal] = $this->calculateAmounts($data);

        return new ParsedWcOrder(
            (int) ($data['id'] ?? 0),
            $this->parseOrderDate($data['date_created'] ?? ($data['date_created_gmt'] ?? null)),
            strtolower(trim((string) ($data['status'] ?? ''))),
            $shipCost, $total, $discTotal, $subtotal, $method, $payStatus, $paidOnline,
            $this->extractCustomerName($billing, $shipping),
            $this->extractPhone($billing, $shipping, $meta),
            !empty($billing['email']) ? trim((string) $billing['email']) : null,
            $addr, $state, $city,
            !empty($data['customer_note']) ? (string) $data['customer_note'] : null,
            $tracking, $courier,
            $this->extractCoupons($data['coupon_lines'] ?? []),
            (array) ($data['line_items'] ?? []),
            !empty($data['customer_id']) ? (int) $data['customer_id'] : null,
            $billing, $shipping
        );
    }

    private function parseOrderDate(mixed $rawDate): CarbonInterface
    {
        if (is_string($rawDate) && !empty(trim($rawDate))) {
            try {
                return Carbon::parse($rawDate);
            } catch (\Throwable) {
                return Carbon::now();
            }
        }

        return Carbon::now();
    }

    private function extractCustomerName(array $billing, array $shipping): ?string
    {
        $shippingName = trim(($shipping['first_name'] ?? '') . ' ' . ($shipping['last_name'] ?? ''));
        if (!empty($shippingName)) {
            return $shippingName;
        }

        $billingName = trim(($billing['first_name'] ?? '') . ' ' . ($billing['last_name'] ?? ''));
        if (!empty($billingName)) {
            return $billingName;
        }

        return null;
    }

    private function extractPhone(array $billing, array $shipping, array $metaData): ?string
    {
        $billingPhone = trim((string) ($billing['phone'] ?? ''));
        if (!empty($billingPhone)) {
            return $billingPhone;
        }

        $shippingPhone = trim((string) ($shipping['phone'] ?? ''));
        if (!empty($shippingPhone)) {
            return $shippingPhone;
        }

        foreach ($metaData as $meta) {
            $key = strtolower(trim((string) ($meta['key'] ?? '')));
            if (in_array($key, self::PHONE_META_KEYS, true)) {
                $val = trim((string) ($meta['value'] ?? ''));
                if (!empty($val)) {
                    return $val;
                }
            }
        }

        return null;
    }

    /**
     * @return array{0: ?string, 1: ?string, 2: ?string}
     */
    private function extractAddress(array $billing, array $shipping): array
    {
        $addr1 = !empty(trim((string) ($shipping['address_1'] ?? ''))) ? trim((string) $shipping['address_1']) : trim((string) ($billing['address_1'] ?? ''));
        $addr2 = !empty(trim((string) ($shipping['address_2'] ?? ''))) ? trim((string) $shipping['address_2']) : trim((string) ($billing['address_2'] ?? ''));
        $city = !empty(trim((string) ($shipping['city'] ?? ''))) ? trim((string) $shipping['city']) : trim((string) ($billing['city'] ?? ''));
        $state = !empty(trim((string) ($shipping['state'] ?? ''))) ? trim((string) $shipping['state']) : trim((string) ($billing['state'] ?? ''));

        $parts = array_filter([$addr1, $addr2, $city, $state]);
        $address = !empty($parts) ? implode(', ', $parts) : null;

        return [
            $address,
            !empty($city) ? $city : null,
            !empty($state) ? $state : null,
        ];
    }

    /**
     * @return array{0: ?string, 1: ?string}
     */
    private function extractTracking(array $metaData): array
    {
        $trackingNumber = null;
        $courierName = null;

        foreach ($metaData as $meta) {
            $key = strtolower((string) ($meta['key'] ?? ''));
            $val = $meta['value'] ?? null;
            if (is_string($val) && !empty(trim($val))) {
                if (in_array($key, self::TRACKING_META_KEYS, true)) {
                    $trackingNumber = trim($val);
                    if (str_contains($key, 'bosta')) {
                        $courierName = 'بوسطة (Bosta)';
                    }
                }
            }
        }

        return [$trackingNumber, $courierName];
    }

    /**
     * @return array{0: bool, 1: WcPaymentStatus}
     */
    private function determinePayment(array $wcOrderData, string $paymentMethod): array
    {
        $methodLower = strtolower($paymentMethod);
        $statusLower = strtolower((string) ($wcOrderData['status'] ?? ''));

        $isPaidOnline = !empty($wcOrderData['date_paid'])
            || (isset($wcOrderData['needs_payment']) && $wcOrderData['needs_payment'] === false && $methodLower !== 'cod')
            || ($methodLower !== 'cod' && in_array($statusLower, ['processing', 'completed'], true))
            || in_array($methodLower, self::ONLINE_GATEWAYS, true);

        $paymentStatus = $isPaidOnline ? WcPaymentStatus::PAID_ONLINE : WcPaymentStatus::PENDING_COD;

        return [$isPaidOnline, $paymentStatus];
    }

    /**
     * @return array{0: Money, 1: Money, 2: Money, 3: Money}
     */
    private function calculateAmounts(array $wcOrderData): array
    {
        $shippingCost = Money::of($wcOrderData['shipping_total'] ?? 0);
        $total = Money::of($wcOrderData['total'] ?? 0);
        $discountTotal = Money::of($wcOrderData['discount_total'] ?? 0);

        $subtotal = $total->subtract($shippingCost)->add($discountTotal);
        if ($subtotal->isNegative()) {
            $subtotal = Money::zero();
        }

        return [$shippingCost, $total, $discountTotal, $subtotal];
    }

    /**
     * @return list<string>
     */
    private function extractCoupons(mixed $couponLines): array
    {
        if (!is_array($couponLines)) {
            return [];
        }

        $codes = [];
        foreach ($couponLines as $line) {
            if (is_array($line) && !empty($line['code'])) {
                $codes[] = (string) $line['code'];
            }
        }

        return $codes;
    }
}
