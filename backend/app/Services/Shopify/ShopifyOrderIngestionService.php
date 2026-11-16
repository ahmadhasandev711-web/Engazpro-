<?php

namespace App\Services\Shopify;

use App\Enums\WcOrderStatus;
use App\Models\Branch;
use App\Models\ShopifyIntegration;
use App\Models\ShopifyLocationMapping;
use App\Models\ShopifyOrder;
use App\Models\ShopifyOrderItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ShopifyOrderIngestionService
{
    public function __construct(
        protected ShopifyOrderPayloadParser $parser,
        protected ShopifyOrderLineItemMapper $lineItemMapper,
        protected ShopifyCustomerSyncService $customerSyncService
    ) {}

    public function ingest(User $user, array $rawOrderData): ShopifyOrder
    {
        $accountId = $user->getAccountId();
        $parsed = $this->parser->parse($rawOrderData);

        $existing = ShopifyOrder::where('user_id', $accountId)
            ->where('shopify_order_id', $parsed['shopify_order_id'])
            ->first();

        return $existing
            ? $this->updateExisting($accountId, $existing, $parsed)
            : $this->createNew($user, $accountId, $parsed);
    }

    private function updateExisting(int $accountId, ShopifyOrder $existing, array $parsed): ShopifyOrder
    {
        return DB::transaction(function () use ($accountId, $existing, $parsed) {
            $locked = ShopifyOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($existing->id);
            $updates = $this->collectUpdates($locked, $parsed);
            if ($parsed['is_cancelled']) {
                $updates = array_merge($updates, $this->buildCancellationUpdates($locked));
            }
            if (!empty($updates)) {
                $locked->update($updates);
            }

            return $locked;
        });
    }

    private function collectUpdates(ShopifyOrder $locked, array $parsed): array
    {
        $updates = array_filter([
            'order_date' => $parsed['order_date'],
            'fulfillment_order_id' => $locked->fulfillment_order_id ?: $parsed['fulfillment_order_id'],
            'customer_phone' => empty($locked->customer_phone) ? $parsed['customer_phone'] : null,
            'customer_address' => empty($locked->customer_address) ? $parsed['customer_address'] : null,
            'city' => empty($locked->city) ? $parsed['city'] : null,
            'governorate' => empty($locked->governorate) ? $parsed['governorate'] : null,
        ], fn ($v) => $v !== null);

        if (empty($locked->items_snapshot) && !empty($parsed['raw_line_items'])) {
            $updates['items_snapshot'] = $this->lineItemMapper->enrich($locked->user_id, $parsed['raw_line_items']);
        }

        return $updates;
    }

    private function buildCancellationUpdates(ShopifyOrder $locked): array
    {
        if ($locked->status->canTransitionTo(WcOrderStatus::CANCELLED)) {
            $tag = '[تم إلغاء الطلب من Shopify]';

            return [
                'status' => WcOrderStatus::CANCELLED,
                'notes' => str_contains($locked->notes ?? '', $tag) ? $locked->notes : trim(($locked->notes ? $locked->notes . ' | ' : '') . $tag),
            ];
        }
        if (!in_array($locked->status, [WcOrderStatus::CANCELLED, WcOrderStatus::RETURNED], true)) {
            $warn = "[تحذير: تم إلغاء الطلب من Shopify ولكن حالته بالنظام '{$locked->status->label()}']";

            return ['notes' => str_contains($locked->notes ?? '', $warn) ? $locked->notes : trim(($locked->notes ? $locked->notes . ' | ' : '') . $warn)];
        }

        return [];
    }

    private function createNew(User $user, int $accountId, array $parsed): ShopifyOrder
    {
        return DB::transaction(function () use ($user, $accountId, $parsed) {
            $party = $this->customerSyncService->syncCustomerFromShopify($user, [
                'customer_id' => $parsed['customer_id'], 'name' => $parsed['customer_name'],
                'phone' => $parsed['customer_phone'], 'email' => $parsed['customer_email'],
                'address' => $parsed['customer_address'],
            ]);
            $branchId = $this->resolveBranchId($accountId, $parsed['shopify_location_id']);
            $snapshot = $this->lineItemMapper->enrich($accountId, $parsed['raw_line_items']);

            $order = $this->persistOrderRecord($accountId, $parsed, $party->id, $branchId, $snapshot);
            $this->persistOrderItems($accountId, $order, $snapshot);

            return $order;
        });
    }

    private function persistOrderRecord(int $accountId, array $parsed, int $partyId, ?int $branchId, array $snapshot): ShopifyOrder
    {
        return ShopifyOrder::create([
            'user_id' => $accountId, 'shopify_order_id' => $parsed['shopify_order_id'],
            'shopify_order_number' => $parsed['shopify_order_number'], 'shopify_location_id' => $parsed['shopify_location_id'],
            'fulfillment_order_id' => $parsed['fulfillment_order_id'], 'order_date' => $parsed['order_date'],
            'party_id' => $partyId, 'branch_id' => $branchId,
            'status' => $parsed['is_cancelled'] ? WcOrderStatus::CANCELLED : WcOrderStatus::PENDING_CONFIRMATION,
            'payment_status' => $parsed['payment_status'], 'shopify_payment_gateway' => $parsed['gateway'],
            'shipping_cost' => $parsed['shipping_cost'], 'subtotal' => $parsed['subtotal'],
            'discount_total' => $parsed['discount_total'], 'total' => $parsed['total'],
            'customer_name' => $parsed['customer_name'], 'customer_phone' => $parsed['customer_phone'],
            'customer_email' => $parsed['customer_email'], 'customer_address' => $parsed['customer_address'],
            'governorate' => $parsed['governorate'], 'city' => $parsed['city'], 'notes' => $parsed['notes'],
            'coupon_codes' => $parsed['coupon_codes'], 'discount_breakdown' => $parsed['discount_breakdown'],
            'items_snapshot' => $snapshot,
        ]);
    }

    private function persistOrderItems(int $accountId, ShopifyOrder $order, array $snapshot): void
    {
        foreach ($snapshot as $item) {
            ShopifyOrderItem::create([
                'user_id' => $accountId,
                'shopify_order_id' => $order->id,
                'product_id' => $item['product_id'],
                'product_variant_id' => $item['product_variant_id'],
                'shopify_product_id' => $item['shopify_product_id'],
                'shopify_variant_id' => $item['shopify_variant_id'],
                'quantity' => $item['quantity'],
            ]);
        }
    }

    private function resolveBranchId(int $accountId, ?int $shopifyLocationId): ?int
    {
        if ($shopifyLocationId) {
            $mapped = ShopifyLocationMapping::withoutGlobalScopes()
                ->where('user_id', $accountId)->where('shopify_location_id', $shopifyLocationId)->value('branch_id');
            if ($mapped) {
                return (int) $mapped;
            }
        }

        return ShopifyIntegration::where('user_id', $accountId)->value('default_branch_id')
            ?? Branch::where('user_id', $accountId)->where('is_main', true)->value('id')
            ?? Branch::where('user_id', $accountId)->value('id');
    }
}
