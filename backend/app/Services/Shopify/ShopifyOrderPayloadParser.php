<?php

namespace App\Services\Shopify;

use App\Enums\WcPaymentStatus;
use App\Support\Money;
use App\Support\Quantity;
use App\Support\ShopifyGid;
use Carbon\Carbon;
use Carbon\CarbonInterface;

class ShopifyOrderPayloadParser
{
    private const PAID_FINANCIAL_STATUSES = ['paid', 'partially_paid', 'authorized'];

    public function parse(array $raw): array
    {
        $isGraphql = isset($raw['lineItems']['edges']);
        $lineItems = $this->normalizeLineItems($raw, $isGraphql);
        $shipping = $raw['shippingAddress'] ?? ($raw['shipping_address'] ?? []);
        $billing = $raw['billingAddress'] ?? ($raw['billing_address'] ?? []);
        $customer = $raw['customer'] ?? [];

        return [
            'shopify_order_id' => ShopifyGid::extractId($raw['id'] ?? null) ?? 0,
            'shopify_order_number' => (string) ($raw['name'] ?? ($raw['order_number'] ?? '')),
            'shopify_location_id' => $this->extractLocationId($raw, $isGraphql),
            'split_fulfillment_locations' => $this->extractSplitLocations($raw, $isGraphql),
            'fulfillment_order_id' => $this->extractFulfillmentOrderId($raw, $isGraphql),
            'currency' => $this->extractCurrency($raw),
            'order_date' => $this->parseDate($raw['createdAt'] ?? ($raw['created_at'] ?? null)),
            'is_cancelled' => !empty($raw['cancelledAt'] ?? ($raw['cancelled_at'] ?? null)),
            'payment_status' => $this->determinePaymentStatus($raw, $isGraphql),
            'gateway' => (string) ($raw['paymentGatewayNames'][0] ?? ($raw['payment_gateway_names'][0] ?? 'cod')),
            ...$this->calculateFinancialTotals($raw, $lineItems, $isGraphql),
            ...$this->extractCustomerFields($raw, $customer, $shipping, $billing),
            'notes' => !empty($raw['note']) ? (string) $raw['note'] : null,
            'coupon_codes' => $this->extractCouponCodes($raw),
            'discount_breakdown' => $this->extractDiscountBreakdown($raw, $isGraphql),
            'raw_line_items' => $lineItems,
        ];
    }

    private function extractCustomerFields(array $raw, array $customer, array $shipping, array $billing): array
    {
        [$addr, $city, $gov] = $this->extractAddress($shipping, $billing);

        return [
            'customer_id' => ShopifyGid::extractId($customer['id'] ?? null),
            'customer_name' => $this->extractCustomerName($customer, $shipping, $billing),
            'customer_phone' => $this->extractPhone($shipping, $billing, $customer, $raw),
            'customer_email' => !empty($customer['email'] ?? ($raw['email'] ?? null)) ? trim((string) ($customer['email'] ?? $raw['email'])) : null,
            'customer_address' => $addr, 'city' => $city, 'governorate' => $gov,
        ];
    }

    private function normalizeLineItems(array $raw, bool $isGraphql): array
    {
        $nodes = $isGraphql ? collect($raw['lineItems']['edges'] ?? [])->pluck('node')->all() : ($raw['line_items'] ?? []);
        $refundedMap = $isGraphql ? [] : $this->buildRestRefundedQuantities($raw['refunds'] ?? []);

        return collect($nodes)->filter(fn ($i) => is_array($i))->map(function (array $item) use ($isGraphql, $refundedMap) {
            $qty = $this->resolveEffectiveLineQuantity($item, $isGraphql, $refundedMap);
            if ($qty <= 0) {
                return null;
            }
            $unitPrice = $isGraphql
                ? Money::of($item['originalUnitPriceSet']['shopMoney']['amount'] ?? ($item['variant']['price'] ?? 0))
                : Money::of($item['price'] ?? 0);
            $compareAt = $item['variant']['compareAtPrice'] ?? ($item['compare_at_price'] ?? null);

            return [
                'shopify_product_id' => ShopifyGid::extractId($item['product']['id'] ?? ($item['product_id'] ?? null)),
                'shopify_variant_id' => ShopifyGid::extractId($item['variant']['id'] ?? ($item['variant_id'] ?? null)),
                'title' => (string) ($item['title'] ?? 'صنف أونلاين'),
                'variant_title' => $item['variant']['title'] ?? ($item['variant_title'] ?? null),
                'sku' => !empty($item['sku']) ? trim((string) $item['sku']) : null,
                'quantity' => $qty,
                'unit_price' => $unitPrice->getAmount(),
                'compare_at_price' => is_numeric($compareAt) ? Money::of($compareAt)->getAmount() : null,
                'image_url' => ShopifyGraphqlQueries::extractVariantMediaUrl($item['variant'] ?? []),
            ];
        })->filter()->values()->all();
    }

    private function resolveEffectiveLineQuantity(array $item, bool $isGraphql, array $refundedMap): float
    {
        if ($isGraphql) {
            return Quantity::of($item['currentQuantity'] ?? ($item['quantity'] ?? 1))->toFloat();
        }
        $lineId = (int) ($item['id'] ?? 0);
        $rawQty = Quantity::of($item['quantity'] ?? 1);
        $refunded = $lineId > 0 && isset($refundedMap[$lineId]) ? Quantity::of($refundedMap[$lineId]) : Quantity::zero();

        return $rawQty->subtract($refunded)->maxZero()->toFloat();
    }

    /**
     * @return array<int, float>
     */
    private function buildRestRefundedQuantities(array $refunds): array
    {
        $map = [];
        foreach ($refunds as $refund) {
            foreach ($refund['refund_line_items'] ?? [] as $rli) {
                $id = (int) ($rli['line_item_id'] ?? 0);
                if ($id > 0) {
                    $map[$id] = ($map[$id] ?? 0.0) + Quantity::of($rli['quantity'] ?? 0)->toFloat();
                }
            }
        }

        return $map;
    }

    private function calculateFinancialTotals(array $raw, array $lineItems, bool $isGraphql): array
    {
        $subtotal = array_reduce($lineItems, fn (Money $c, array $i) => $c->add(Money::of($i['unit_price'])->multiply($i['quantity'])), Money::zero());
        $shipping = $this->resolveNetShippingMoney($raw, $isGraphql);
        $taxesIncluded = (bool) ($raw['taxesIncluded'] ?? ($raw['taxes_included'] ?? false));
        $rawTax = Money::of($isGraphql ? ($raw['currentTotalTaxSet']['shopMoney']['amount'] ?? 0) : ($raw['current_total_tax'] ?? ($raw['total_tax'] ?? 0)));
        $applicableTax = $taxesIncluded ? Money::zero() : $rawTax;
        $rawTotal = $isGraphql ? ($raw['currentTotalPriceSet']['shopMoney']['amount'] ?? 0) : ($raw['current_total_price'] ?? ($raw['total_price'] ?? 0));
        $total = Money::of($rawTotal);

        $reconciledDiscount = $subtotal->add($shipping)->add($applicableTax)->subtract($total);
        if ($reconciledDiscount->isNegative()) {
            $reconciledDiscount = Money::zero();
        }

        return [
            'subtotal' => $subtotal->getAmount(),
            'shipping_cost' => $shipping->getAmount(),
            'discount_total' => $reconciledDiscount->getAmount(),
            'tax_total' => $applicableTax->getAmount(),
            'total' => $total->getAmount(),
        ];
    }

    private function resolveNetShippingMoney(array $raw, bool $isGraphql): Money
    {
        if ($isGraphql) {
            return Money::of($raw['totalShippingPriceSet']['shopMoney']['amount'] ?? 0);
        }
        $lines = $raw['shipping_lines'] ?? [];
        if (!empty($lines) && is_array($lines)) {
            return collect($lines)->reduce(fn (Money $c, $l) => $c->add(Money::of($l['discounted_price'] ?? ($l['price'] ?? 0))), Money::zero());
        }

        return Money::of($raw['total_shipping_price_set']['shop_money']['amount'] ?? 0);
    }

    private function determinePaymentStatus(array $raw, bool $isGraphql): WcPaymentStatus
    {
        $fin = strtolower((string) ($isGraphql ? ($raw['displayFinancialStatus'] ?? '') : ($raw['financial_status'] ?? '')));

        return in_array($fin, self::PAID_FINANCIAL_STATUSES, true)
            ? WcPaymentStatus::PAID_ONLINE
            : WcPaymentStatus::PENDING_COD;
    }

    private function extractLocationId(array $raw, bool $isGraphql): ?int
    {
        if ($isGraphql) {
            $foNode = $raw['fulfillmentOrders']['edges'][0]['node'] ?? null;

            return ShopifyGid::extractId($foNode['assignedLocation']['location']['id'] ?? null);
        }

        return ShopifyGid::extractId($raw['location_id'] ?? null);
    }

    /**
     * @return list<int>
     */
    private function extractSplitLocations(array $raw, bool $isGraphql): array
    {
        $edges = $isGraphql ? ($raw['fulfillmentOrders']['edges'] ?? []) : [];
        $ids = collect($edges)
            ->map(fn ($edge) => ShopifyGid::extractId($edge['node']['assignedLocation']['location']['id'] ?? null))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return count($ids) > 1 ? $ids : [];
    }

    private function extractFulfillmentOrderId(array $raw, bool $isGraphql): ?int
    {
        if (!$isGraphql) {
            return null;
        }

        return ShopifyGid::extractId($raw['fulfillmentOrders']['edges'][0]['node']['id'] ?? null);
    }

    private function extractCurrency(array $raw): ?string
    {
        $code = $raw['currencyCode'] ?? ($raw['currentTotalPriceSet']['shopMoney']['currencyCode'] ?? ($raw['currency'] ?? null));

        return is_string($code) && trim($code) !== '' ? strtoupper(trim($code)) : null;
    }

    private function parseDate(mixed $val): CarbonInterface
    {
        if (is_string($val) && trim($val) !== '') {
            try {
                return Carbon::parse($val);
            } catch (\Throwable) {
                return Carbon::now();
            }
        }

        return Carbon::now();
    }

    /**
     * @return array{0: ?string, 1: ?string, 2: ?string}
     */
    private function extractAddress(array $shipping, array $billing): array
    {
        $a1 = trim((string) ($shipping['address1'] ?? ($billing['address1'] ?? '')));
        $a2 = trim((string) ($shipping['address2'] ?? ($billing['address2'] ?? '')));
        $city = trim((string) ($shipping['city'] ?? ($billing['city'] ?? '')));
        $gov = trim((string) ($shipping['province'] ?? ($billing['province'] ?? '')));
        $parts = array_filter([$a1, $a2, $city, $gov]);

        return [!empty($parts) ? implode(', ', $parts) : null, $city !== '' ? $city : null, $gov !== '' ? $gov : null];
    }

    private function extractCustomerName(array $customer, array $shipping, array $billing): ?string
    {
        foreach ([$shipping, $billing, $customer] as $src) {
            $first = trim((string) ($src['firstName'] ?? ($src['first_name'] ?? '')));
            $last = trim((string) ($src['lastName'] ?? ($src['last_name'] ?? '')));
            $full = trim("{$first} {$last}");
            if ($full !== '') {
                return $full;
            }
        }

        return null;
    }

    private function extractPhone(array $shipping, array $billing, array $customer, array $raw): ?string
    {
        foreach ([$shipping['phone'] ?? null, $billing['phone'] ?? null, $customer['phone'] ?? null, $raw['phone'] ?? null] as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return null;
    }

    private function extractCouponCodes(array $raw): array
    {
        $gqlCodes = $raw['discountCodes'] ?? null;
        if (is_array($gqlCodes)) {
            return collect($gqlCodes)->filter()->values()->all();
        }

        return collect($raw['discount_codes'] ?? [])->pluck('code')->filter()->values()->all();
    }

    private function extractDiscountBreakdown(array $raw, bool $isGraphql): array
    {
        $apps = $isGraphql ? collect($raw['discountApplications']['edges'] ?? [])->pluck('node')->all() : ($raw['discount_applications'] ?? []);

        return collect($apps)->filter(fn ($a) => is_array($a))->map(fn (array $app) => [
            'code' => $app['code'] ?? null,
            'title' => $app['title'] ?? null,
            'type' => $app['type'] ?? ($app['allocationMethod'] ?? 'discount'),
            'target_type' => strtolower((string) ($app['targetType'] ?? ($app['target_type'] ?? 'line_item'))),
            'value' => $app['value']['amount'] ?? ($app['value']['percentage'] ?? ($app['value'] ?? null)),
        ])->values()->all();
    }
}
