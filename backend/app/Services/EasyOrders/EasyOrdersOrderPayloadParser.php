<?php

namespace App\Services\EasyOrders;

use App\Enums\WcPaymentStatus;
use App\Support\Money;
use App\Support\Quantity;
use Carbon\Carbon;
use Carbon\CarbonInterface;

class EasyOrdersOrderPayloadParser
{
    public function parse(array $raw): array
    {
        $rawStatus = (string) ($raw['status'] ?? '');
        $shipping = Money::of($raw['shipping_cost'] ?? 0);
        $cost = Money::of($raw['cost'] ?? 0);
        $total = Money::of($raw['total_cost'] ?? 0);
        $gross = $cost->add($shipping);
        $discount = $gross->greaterThan($total) ? $gross->subtract($total) : Money::zero();

        return [
            'external_order_id' => (string) ($raw['id'] ?? ''),
            'external_order_number' => $this->resolveOrderNumber($raw),
            'order_date' => $this->parseDate($raw['created_at'] ?? ($raw['updated_at'] ?? null)),
            'is_cancelled' => EasyOrdersStatusMap::isCancelled($rawStatus),
            'payment_status' => $this->resolvePaymentStatus($raw, $rawStatus),
            'gateway' => (string) ($raw['payment_method'] ?? 'cod'),
            'shipping_cost' => $shipping,
            'subtotal' => $cost,
            'discount_total' => $discount,
            'total' => $total,
            'customer_name' => trim((string) ($raw['full_name'] ?? '')) ?: 'عميل إيزي أوردر',
            'customer_phone' => !empty($raw['phone']) ? trim((string) $raw['phone']) : null,
            'customer_address' => !empty($raw['address']) ? trim((string) $raw['address']) : null,
            'governorate' => !empty($raw['government']) ? trim((string) $raw['government']) : null,
            'notes' => !empty($raw['notes']) ? (string) $raw['notes'] : null,
            'coupon_codes' => $this->extractCouponCodes($raw),
            'raw_line_items' => $this->normalizeCartItems($raw['cart_items'] ?? []),
        ];
    }

    private function resolveOrderNumber(array $raw): string
    {
        if (!empty($raw['short_id'])) {
            return '#' . $raw['short_id'];
        }

        return '#' . substr((string) ($raw['id'] ?? 'EO'), 0, 8);
    }

    private function resolvePaymentStatus(array $raw, string $rawStatus): WcPaymentStatus
    {
        $method = strtolower(trim((string) ($raw['payment_method'] ?? 'cod')));
        $normStatus = EasyOrdersStatusMap::normalize($rawStatus);
        if (EasyOrdersStatusMap::isPaidOnline($rawStatus) || ($method !== '' && $method !== 'cod' && $normStatus === EasyOrdersStatusMap::DELIVERED)) {
            return WcPaymentStatus::PAID_ONLINE;
        }
        if ($method !== '' && $method !== 'cod' && !empty($raw['payment_ref_id'])) {
            return WcPaymentStatus::PAID_ONLINE;
        }

        return WcPaymentStatus::PENDING_COD;
    }

    private function parseDate(mixed $dateStr): CarbonInterface
    {
        try {
            return $dateStr ? Carbon::parse((string) $dateStr) : now();
        } catch (\Throwable) {
            return now();
        }
    }

    /**
     * @return list<string>
     */
    private function extractCouponCodes(array $raw): array
    {
        $code = trim((string) ($raw['coupon']['code'] ?? ($raw['coupon_code'] ?? '')));

        return $code !== '' ? [$code] : [];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function normalizeCartItems(array $items): array
    {
        return collect($items)->filter(fn ($i) => is_array($i))->map(function (array $item) {
            $product = is_array($item['product'] ?? null) ? $item['product'] : [];
            $variant = is_array($item['variant'] ?? null) ? $item['variant'] : [];

            return [
                'easyorders_product_id' => !empty($item['product_id']) ? (string) $item['product_id'] : null,
                'easyorders_variant_id' => !empty($item['variant_id']) ? (string) $item['variant_id'] : null,
                'title' => (string) ($product['name'] ?? 'صنف أونلاين'),
                'variant_title' => $this->extractVariantLabel($variant),
                'sku' => !empty($product['sku']) ? trim((string) $product['sku']) : null,
                'product_taager_code' => !empty($product['taager_code']) ? trim((string) $product['taager_code']) : null,
                'variant_taager_code' => !empty($variant['taager_code']) ? trim((string) $variant['taager_code']) : null,
                'quantity' => Quantity::of($item['quantity'] ?? 1)->toDecimalString(),
                'unit_price' => Money::of($item['price'] ?? ($variant['price'] ?? ($product['price'] ?? 0)))->getAmount(),
                'image_url' => $product['thumb'] ?? null,
            ];
        })->values()->all();
    }

    private function extractVariantLabel(array $variant): ?string
    {
        $props = $variant['variation_props'] ?? [];
        if (!is_array($props) || empty($props)) {
            return null;
        }

        $parts = collect($props)->map(fn ($p) => trim((string) ($p['variation_prop'] ?? '')))->filter()->all();

        return !empty($parts) ? implode(' / ', $parts) : null;
    }
}
