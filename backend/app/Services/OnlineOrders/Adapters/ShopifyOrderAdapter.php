<?php

namespace App\Services\OnlineOrders\Adapters;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Contracts\StorePlatformOrderAdapterInterface;
use App\DTOs\ParsedOnlineOrder;
use App\Enums\EcommercePlatform;
use App\Exceptions\PosDomainException;
use App\Jobs\CancelShopifyOrderJob;
use App\Jobs\PushStockToShopifyJob;
use App\Jobs\SyncFulfillmentToShopifyJob;
use App\Models\Branch;
use App\Models\OnlineOrder;
use App\Models\Party;
use App\Models\Product;
use App\Models\ShopifyIntegration;
use App\Models\ShopifyLocationMapping;
use App\Models\User;
use App\Services\Shopify\ShopifyCustomerSyncService;
use App\Services\Shopify\ShopifyOrderLineItemMapper;
use App\Services\Shopify\ShopifyOrderPayloadParser;
use App\Services\Shopify\ShopifyStockSyncGate;
use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Support\Facades\Log;

class ShopifyOrderAdapter implements StorePlatformOrderAdapterInterface
{
    public function __construct(
        private readonly ShopifyGraphqlClientInterface $graphqlClient,
        private readonly ShopifyOrderPayloadParser $parser,
        private readonly ShopifyOrderLineItemMapper $lineItemMapper,
        private readonly ShopifyCustomerSyncService $customerSyncService,
    ) {}

    public function platform(): EcommercePlatform
    {
        return EcommercePlatform::SHOPIFY;
    }

    public function isSyncActive(int $accountId): bool
    {
        return ShopifyStockSyncGate::isActive($accountId);
    }

    public function fetchRecentPayloads(User $user, int $limit = 25): array
    {
        $integration = ShopifyIntegration::where('user_id', $user->getAccountId())->where('is_active', true)->first();
        if (!$integration) {
            throw new PosDomainException('ربط شوبيفاي غير مفعل أو لم يتم تهيئته بعد.', 'SHOPIFY_INACTIVE', 422);
        }

        $cursor = null;
        $collected = [];
        $cap = max(1, min($limit, 250));
        do {
            $batchSize = min(25, $cap - count($collected));
            $page = $this->graphqlClient->getOrdersPage($integration, $cursor, $batchSize, 'status:open -fulfillment_status:fulfilled');
            $collected = array_merge($collected, $page['orders']);
            $cursor = $page['end_cursor'];
        } while ($page['has_next_page'] && $cursor && count($collected) < $cap);

        return array_slice($collected, 0, $cap);
    }

    public function parsePayload(array $rawPayload): ParsedOnlineOrder
    {
        return new ParsedOnlineOrder(...$this->mapParsedFields($this->parser->parse($rawPayload)));
    }

    /**
     * @return array<string, mixed>
     */
    private function mapParsedFields(array $parsed): array
    {
        return [
            'platform' => EcommercePlatform::SHOPIFY,
            'externalOrderId' => (string) $parsed['shopify_order_id'],
            'externalOrderNumber' => $parsed['shopify_order_number'] ?: '#' . $parsed['shopify_order_id'],
            'orderDate' => $parsed['order_date'], 'isCancelled' => (bool) $parsed['is_cancelled'],
            'shippingCost' => Money::of($parsed['shipping_cost']), 'subtotal' => Money::of($parsed['subtotal']),
            'discountTotal' => Money::of($parsed['discount_total']), 'total' => Money::of($parsed['total']),
            'paymentMethodLabel' => (string) $parsed['gateway'], 'paymentStatus' => $parsed['payment_status'],
            'customerId' => $parsed['customer_id'], 'customerName' => $parsed['customer_name'],
            'customerPhone' => $parsed['customer_phone'], 'customerEmail' => $parsed['customer_email'],
            'customerAddress' => $parsed['customer_address'], 'governorate' => $parsed['governorate'],
            'city' => $parsed['city'], 'notes' => $parsed['notes'],
            'trackingNumber' => null, 'courierName' => null,
            'couponCodes' => $parsed['coupon_codes'], 'discountBreakdown' => $parsed['discount_breakdown'],
            'rawLineItems' => $parsed['raw_line_items'],
            'platformMeta' => array_filter([
                'shopify_location_id' => $parsed['shopify_location_id'],
                'fulfillment_order_id' => $parsed['fulfillment_order_id'],
                'split_fulfillment_locations' => !empty($parsed['split_fulfillment_locations']) ? $parsed['split_fulfillment_locations'] : null,
                'shopify_currency' => $parsed['currency'],
            ], fn ($v) => $v !== null),
            'customerContext' => [],
            'taxTotal' => Money::of($parsed['tax_total'] ?? 0),
        ];
    }

    public function mapOrderItems(int $accountId, ParsedOnlineOrder $parsed): array
    {
        $snapshot = $this->lineItemMapper->enrich($accountId, $parsed->rawLineItems);
        $itemRows = array_map(fn (array $item): array => [
            'user_id' => $accountId,
            'product_id' => $item['product_id'],
            'product_variant_id' => $item['product_variant_id'],
            'external_product_id' => !empty($item['shopify_product_id']) ? (string) $item['shopify_product_id'] : null,
            'external_variant_id' => !empty($item['shopify_variant_id']) ? (string) $item['shopify_variant_id'] : null,
            'quantity' => Quantity::of($item['quantity'] ?? 1)->toDecimalString(),
        ], $snapshot);

        return ['snapshot' => $snapshot, 'item_rows' => $itemRows];
    }

    public function resolveItemProduct(int $accountId, array $snapshotItem): array
    {
        $product = !empty($snapshotItem['product_id'])
            ? Product::where('user_id', $accountId)->find((int) $snapshotItem['product_id'])
            : Product::where('user_id', $accountId)->where('shopify_product_id', (int) ($snapshotItem['shopify_product_id'] ?? 0))->first();

        $variant = null;
        if ($product && !empty($snapshotItem['product_variant_id'])) {
            $variant = $product->variants()->find((int) $snapshotItem['product_variant_id']);
        } elseif ($product && !empty($snapshotItem['shopify_variant_id'])) {
            $variant = $product->variants()->where('shopify_variant_id', (int) $snapshotItem['shopify_variant_id'])->first();
        }

        return ['product' => $product, 'variant' => $variant];
    }

    public function syncCustomer(User $user, ParsedOnlineOrder $parsed): ?Party
    {
        return $this->customerSyncService->syncCustomerFromShopify($user, [
            'customer_id' => $parsed->customerId,
            'name' => $parsed->customerName,
            'phone' => $parsed->customerPhone,
            'email' => $parsed->customerEmail,
            'address' => $parsed->customerAddress,
        ]);
    }

    public function resolveBranchId(int $accountId, ParsedOnlineOrder $parsed): ?int
    {
        $locationId = $parsed->platformMeta['shopify_location_id'] ?? null;
        if ($locationId) {
            $mapped = ShopifyLocationMapping::withoutGlobalScopes()
                ->where('user_id', $accountId)
                ->where('shopify_location_id', $locationId)
                ->where('is_active', true)
                ->value('branch_id');
            if ($mapped && Branch::where('user_id', $accountId)->where('id', $mapped)->where('is_active', true)->exists()) {
                return (int) $mapped;
            }
        }

        $defaultId = ShopifyIntegration::where('user_id', $accountId)->value('default_branch_id');
        if ($defaultId && Branch::where('user_id', $accountId)->where('id', $defaultId)->where('is_active', true)->exists()) {
            return (int) $defaultId;
        }

        return Branch::where('user_id', $accountId)->where('is_main', true)->where('is_active', true)->value('id')
            ?? Branch::where('user_id', $accountId)->where('is_active', true)->value('id');
    }

    public function invoiceReferencePayload(OnlineOrder $order): array
    {
        return ['shopify_order_id' => (int) $order->external_order_id];
    }

    public function dispatchDeliveredSync(OnlineOrder $order): void
    {
        try {
            SyncFulfillmentToShopifyJob::dispatch($order->user_id, $order->id)->afterCommit();
        } catch (\Throwable $e) {
            Log::warning("Failed to dispatch Shopify fulfillment sync for order #{$order->id}: " . $e->getMessage());
        }
    }

    public function dispatchCancelledSync(OnlineOrder $order): void
    {
        try {
            CancelShopifyOrderJob::dispatch($order->user_id, $order->id)->afterCommit();
        } catch (\Throwable $e) {
            Log::warning("Failed to dispatch Shopify order cancel for order #{$order->id}: " . $e->getMessage());
        }
    }

    public function dispatchStockPush(int $accountId, int $productId, ?int $variantId, ?int $branchId): void
    {
        if ($branchId !== null) {
            $isMapped = ShopifyLocationMapping::withoutGlobalScopes()
                ->where('user_id', $accountId)
                ->where('branch_id', $branchId)
                ->where('is_active', true)
                ->where('auto_sync_stock', true)
                ->exists();
            if (!$isMapped) {
                return;
            }
        }
        PushStockToShopifyJob::dispatch($accountId, $productId, $variantId, $branchId)->afterCommit();
    }
}
