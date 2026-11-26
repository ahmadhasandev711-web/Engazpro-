<?php

namespace App\Services\OnlineOrders\Adapters;

use App\Contracts\EasyOrdersApiClientInterface;
use App\Contracts\StorePlatformOrderAdapterInterface;
use App\DTOs\ParsedOnlineOrder;
use App\Enums\EcommercePlatform;
use App\Exceptions\PosDomainException;
use App\Jobs\PullEasyOrdersOrdersJob;
use App\Jobs\PushStockToEasyOrdersJob;
use App\Jobs\SyncStatusToEasyOrdersJob;
use App\Models\Branch;
use App\Models\EasyOrdersIntegration;
use App\Models\OnlineOrder;
use App\Models\Party;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\EasyOrders\EasyOrdersCustomerSyncService;
use App\Services\EasyOrders\EasyOrdersOrderLineItemMapper;
use App\Services\EasyOrders\EasyOrdersOrderPayloadParser;
use App\Services\EasyOrders\EasyOrdersStatusMap;
use App\Services\EasyOrders\EasyOrdersStockSyncGate;
use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Support\Facades\Log;

class EasyOrdersOrderAdapter implements StorePlatformOrderAdapterInterface
{
    public function __construct(
        private readonly EasyOrdersApiClientInterface $apiClient,
        private readonly EasyOrdersOrderPayloadParser $parser,
        private readonly EasyOrdersOrderLineItemMapper $lineItemMapper,
        private readonly EasyOrdersCustomerSyncService $customerSyncService,
    ) {}

    public function platform(): EcommercePlatform
    {
        return EcommercePlatform::EASYORDERS;
    }

    public function isSyncActive(int $accountId): bool
    {
        return EasyOrdersStockSyncGate::isActive($accountId);
    }

    public function fetchRecentPayloads(User $user, int $limit = 25): array
    {
        $integration = EasyOrdersIntegration::where('user_id', $user->getAccountId())->where('is_active', true)->first();
        if (!$integration || empty($integration->api_key)) {
            throw new PosDomainException('ربط EasyOrders غير مفعّل أو لم يتم تهيئته بعد.', 'EASYORDERS_INACTIVE', 422);
        }

        $page = 1;
        $collected = [];
        $cap = max(1, min($limit, 100));
        do {
            $res = $this->apiClient->getOrdersPage($integration, $page, min(20, $cap));
            $collected = array_merge($collected, $res['orders']);
            $page++;
        } while ($res['has_next_page'] && count($collected) < $cap && $page <= 5);

        return array_slice($collected, 0, $cap);
    }

    public function parsePayload(array $rawPayload): ParsedOnlineOrder
    {
        return new ParsedOnlineOrder(...$this->mapParsedFields($this->parser->parse($rawPayload), $rawPayload));
    }

    /**
     * @return array<string, mixed>
     */
    private function mapParsedFields(array $p, array $rawPayload): array
    {
        return [
            'platform' => EcommercePlatform::EASYORDERS, 'externalOrderId' => $p['external_order_id'],
            'externalOrderNumber' => $p['external_order_number'], 'orderDate' => $p['order_date'],
            'isCancelled' => (bool) $p['is_cancelled'], 'shippingCost' => $p['shipping_cost'],
            'subtotal' => $p['subtotal'], 'discountTotal' => $p['discount_total'], 'total' => $p['total'],
            'paymentMethodLabel' => $p['gateway'], 'paymentStatus' => $p['payment_status'],
            'customerId' => null, 'customerName' => $p['customer_name'], 'customerPhone' => $p['customer_phone'],
            'customerEmail' => null, 'customerAddress' => $p['customer_address'],
            'governorate' => $p['governorate'], 'city' => null, 'notes' => $p['notes'],
            'trackingNumber' => null, 'courierName' => null, 'couponCodes' => $p['coupon_codes'],
            'discountBreakdown' => [], 'rawLineItems' => $p['raw_line_items'],
            'platformMeta' => ['easyorders_status' => $rawPayload['status'] ?? null],
            'customerContext' => [], 'taxTotal' => Money::zero(),
        ];
    }

    public function mapOrderItems(int $accountId, ParsedOnlineOrder $parsed): array
    {
        $snapshot = $this->lineItemMapper->enrich($accountId, $parsed->rawLineItems);
        $itemRows = array_map(fn (array $item): array => [
            'user_id' => $accountId,
            'product_id' => $item['product_id'],
            'product_variant_id' => $item['product_variant_id'],
            'external_product_id' => $item['easyorders_product_id'],
            'external_variant_id' => $item['easyorders_variant_id'],
            'quantity' => Quantity::of($item['quantity'] ?? 1)->toDecimalString(),
        ], $snapshot);

        return ['snapshot' => $snapshot, 'item_rows' => $itemRows];
    }

    public function resolveItemProduct(int $accountId, array $snapshotItem): array
    {
        $product = !empty($snapshotItem['product_id'])
            ? Product::where('user_id', $accountId)->find((int) $snapshotItem['product_id'])
            : Product::where('user_id', $accountId)->where('easyorders_product_id', (string) ($snapshotItem['easyorders_product_id'] ?? ''))->first();

        $variant = null;
        if ($product && !empty($snapshotItem['product_variant_id'])) {
            $variant = $product->variants()->find((int) $snapshotItem['product_variant_id']);
        } elseif ($product && !empty($snapshotItem['easyorders_variant_id'])) {
            $variant = $product->variants()->where('easyorders_variant_id', (string) $snapshotItem['easyorders_variant_id'])->first();
        }

        return ['product' => $product, 'variant' => $variant];
    }

    public function syncCustomer(User $user, ParsedOnlineOrder $parsed): ?Party
    {
        return $this->customerSyncService->syncCustomer($user, [
            'name' => $parsed->customerName,
            'phone' => $parsed->customerPhone,
            'address' => $parsed->customerAddress,
        ]);
    }

    public function resolveBranchId(int $accountId, ParsedOnlineOrder $parsed): ?int
    {
        $defaultId = EasyOrdersIntegration::where('user_id', $accountId)->value('default_branch_id');
        if ($defaultId && Branch::where('user_id', $accountId)->where('id', $defaultId)->where('is_active', true)->exists()) {
            return (int) $defaultId;
        }

        return Branch::where('user_id', $accountId)->where('is_main', true)->where('is_active', true)->value('id')
            ?? Branch::where('user_id', $accountId)->where('is_active', true)->value('id');
    }

    public function invoiceReferencePayload(OnlineOrder $order): array
    {
        return [];
    }

    public function dispatchDeliveredSync(OnlineOrder $order): void
    {
        try {
            SyncStatusToEasyOrdersJob::dispatch($order->user_id, $order->id, EasyOrdersStatusMap::DELIVERED)->afterCommit();
        } catch (\Throwable $e) {
            Log::warning("Failed to dispatch EasyOrders delivered status for order #{$order->id}: " . $e->getMessage());
        }
    }

    public function dispatchCancelledSync(OnlineOrder $order): void
    {
        try {
            SyncStatusToEasyOrdersJob::dispatch($order->user_id, $order->id, EasyOrdersStatusMap::CANCELED)->afterCommit();
        } catch (\Throwable $e) {
            Log::warning("Failed to dispatch EasyOrders canceled status for order #{$order->id}: " . $e->getMessage());
        }
    }

    public function dispatchStockPush(int $accountId, int $productId, ?int $variantId, ?int $branchId): void
    {
        $integration = EasyOrdersIntegration::withoutGlobalScopes()
            ->where('user_id', $accountId)
            ->where('is_active', true)
            ->where('auto_sync_stock', true)
            ->first();

        if (!$integration) {
            return;
        }
        $targetBranch = $integration->default_branch_id ?: Branch::where('user_id', $accountId)->where('is_main', true)->value('id');
        if ($branchId !== null && $targetBranch && (int) $branchId !== (int) $targetBranch) {
            return;
        }

        PushStockToEasyOrdersJob::dispatch($accountId, $productId, $variantId)->afterCommit();
    }
}
