<?php

namespace App\Services\OnlineOrders\Adapters;

use App\Contracts\StorePlatformOrderAdapterInterface;
use App\Contracts\WooCommerceApiClientInterface;
use App\DTOs\ParsedOnlineOrder;
use App\DTOs\ParsedWcOrder;
use App\Enums\EcommercePlatform;
use App\Exceptions\PosDomainException;
use App\Jobs\PushStockToWooCommerceJob;
use App\Jobs\SyncOrderStatusToWooCommerceJob;
use App\Models\Branch;
use App\Models\OnlineOrder;
use App\Models\Party;
use App\Models\Product;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WcOrderLineItemMapper;
use App\Services\WooCommerce\WcOrderPayloadParser;
use App\Services\WooCommerce\WooCommerceCustomerSyncService;
use App\Services\WooCommerce\WooStockSyncGate;
use Illuminate\Support\Facades\Log;

class WooCommerceOrderAdapter implements StorePlatformOrderAdapterInterface
{
    public function __construct(
        private readonly WooCommerceApiClientInterface $apiClient,
        private readonly WcOrderPayloadParser $parser,
        private readonly WcOrderLineItemMapper $lineItemMapper,
        private readonly WooCommerceCustomerSyncService $customerSyncService,
    ) {}

    public function platform(): EcommercePlatform
    {
        return EcommercePlatform::WOOCOMMERCE;
    }

    public function isSyncActive(int $accountId): bool
    {
        return WooStockSyncGate::isActive($accountId);
    }

    public function fetchRecentPayloads(User $user, int $limit = 30): array
    {
        $integration = WooCommerceIntegration::where('user_id', $user->getAccountId())->first();
        if (!$integration || !$integration->is_active) {
            throw new PosDomainException('ربط ووكومرس غير مفعل أو لم يتم تهيئته بعد.', 'WOOCOMMERCE_INACTIVE', 422);
        }

        $collected = [];
        foreach (['processing', 'pending', 'on-hold'] as $status) {
            $collected = array_merge($collected, $this->fetchStatusPages($integration, $status, $limit));
        }

        return $collected;
    }

    public function parsePayload(array $rawPayload): ParsedOnlineOrder
    {
        $wc = $this->parser->parse($rawPayload);

        return new ParsedOnlineOrder(...$this->mapParsedFields($wc));
    }

    /**
     * @return array<string, mixed>
     */
    private function mapParsedFields(ParsedWcOrder $wc): array
    {
        return [
            'platform' => EcommercePlatform::WOOCOMMERCE,
            'externalOrderId' => (string) $wc->wcOrderId,
            'externalOrderNumber' => '#' . $wc->wcOrderId,
            'orderDate' => $wc->orderDate, 'isCancelled' => $wc->status === 'cancelled',
            'shippingCost' => $wc->shippingCost, 'subtotal' => $wc->subtotal,
            'discountTotal' => $wc->discountTotal, 'total' => $wc->total,
            'paymentMethodLabel' => $wc->paymentMethod, 'paymentStatus' => $wc->paymentStatus,
            'customerId' => $wc->customerId, 'customerName' => $wc->customerName,
            'customerPhone' => $wc->customerPhone, 'customerEmail' => $wc->customerEmail,
            'customerAddress' => $wc->customerAddress, 'governorate' => $wc->governorate,
            'city' => $wc->city, 'notes' => $wc->notes,
            'trackingNumber' => $wc->trackingNumber, 'courierName' => $wc->courierName,
            'couponCodes' => $wc->couponCodes, 'discountBreakdown' => [],
            'rawLineItems' => $wc->rawLineItems,
            'platformMeta' => ['anoofy_outbound_version' => 0],
            'customerContext' => ['billing' => $wc->billing, 'shipping' => $wc->shipping],
        ];
    }

    public function mapOrderItems(int $accountId, ParsedOnlineOrder $parsed): array
    {
        [$products, $variants] = $this->lineItemMapper->mapCatalog($accountId, $parsed->rawLineItems);
        $snapshot = $this->lineItemMapper->enrich($accountId, $parsed->rawLineItems, $products, $variants);
        $rawRows = $this->lineItemMapper->buildItemRows($accountId, 0, $parsed->rawLineItems, $products, $variants);

        $itemRows = array_map(fn (array $row): array => [
            'user_id' => $accountId,
            'product_id' => $row['product_id'],
            'product_variant_id' => $row['product_variant_id'],
            'external_product_id' => !empty($row['wc_product_id']) ? (string) $row['wc_product_id'] : null,
            'external_variant_id' => !empty($row['wc_variation_id']) ? (string) $row['wc_variation_id'] : null,
            'quantity' => $row['quantity'],
        ], $rawRows);

        return ['snapshot' => $snapshot, 'item_rows' => $itemRows];
    }

    public function resolveItemProduct(int $accountId, array $snapshotItem): array
    {
        $product = Product::where('user_id', $accountId)
            ->where('wc_product_id', (int) ($snapshotItem['product_id'] ?? 0))
            ->first()
            ?? (!empty($snapshotItem['product_id']) ? Product::where('user_id', $accountId)->find($snapshotItem['product_id']) : null);

        $variant = ($product && !empty($snapshotItem['variation_id']))
            ? $product->variants()->where('wc_variation_id', (int) $snapshotItem['variation_id'])->first()
            : null;

        return ['product' => $product, 'variant' => $variant];
    }

    public function syncCustomer(User $user, ParsedOnlineOrder $parsed): ?Party
    {
        $billing = $parsed->customerContext['billing'] ?? [];
        $shipping = $parsed->customerContext['shipping'] ?? [];

        return $this->customerSyncService->syncCustomerFromWooCommerce($user, [
            'id' => $parsed->customerId,
            'billing' => $billing,
            'shipping' => $shipping,
            'first_name' => $billing['first_name'] ?? ($shipping['first_name'] ?? ''),
            'last_name' => $billing['last_name'] ?? ($shipping['last_name'] ?? ''),
            'phone' => $parsed->customerPhone ?: ($billing['phone'] ?? ($shipping['phone'] ?? '')),
            'email' => $parsed->customerEmail ?? ($billing['email'] ?? null),
        ]);
    }

    public function resolveBranchId(int $accountId, ParsedOnlineOrder $parsed): ?int
    {
        $branchId = WooCommerceIntegration::withoutGlobalScopes()
            ->where('user_id', $accountId)
            ->value('online_branch_id');

        if (!empty($branchId)) {
            $active = Branch::where('user_id', $accountId)->where('id', $branchId)->where('is_active', true)->value('id');
            if ($active) {
                return (int) $active;
            }
        }

        return Branch::where('user_id', $accountId)->where('is_main', true)->where('is_active', true)->value('id')
            ?? Branch::where('user_id', $accountId)->where('is_active', true)->value('id');
    }

    public function invoiceReferencePayload(OnlineOrder $order): array
    {
        return ['wc_order_id' => (int) $order->external_order_id];
    }

    public function dispatchDeliveredSync(OnlineOrder $order): void
    {
        $this->dispatchStatusSync($order->user_id, (int) $order->external_order_id, 'completed');
    }

    public function dispatchCancelledSync(OnlineOrder $order): void
    {
        $this->dispatchStatusSync($order->user_id, (int) $order->external_order_id, 'cancelled');
    }

    public function dispatchStockPush(int $accountId, int $productId, ?int $variantId, ?int $branchId): void
    {
        PushStockToWooCommerceJob::dispatch($accountId, $productId, $variantId)->afterCommit();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function fetchStatusPages(WooCommerceIntegration $integration, string $status, int $limit): array
    {
        $collected = [];
        for ($page = 1; $page <= 10; $page++) {
            $orders = $this->apiClient->getOrders($integration, $status, $page, $limit);
            if (empty($orders)) {
                break;
            }
            foreach ($orders as $orderData) {
                if (!empty($orderData['id'])) {
                    $collected[] = $orderData;
                }
            }
            if (count($orders) < $limit) {
                break;
            }
        }

        return $collected;
    }

    private function dispatchStatusSync(int $accountId, int $wcOrderId, string $wcStatus): void
    {
        try {
            SyncOrderStatusToWooCommerceJob::dispatch($accountId, $wcOrderId, $wcStatus)->afterCommit();
        } catch (\Throwable $e) {
            Log::warning("Failed to dispatch WooCommerce status sync for order #{$wcOrderId}: " . $e->getMessage());
        }
    }
}
