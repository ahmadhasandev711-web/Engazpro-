<?php

namespace App\Services\WooCommerce;

use App\DTOs\ParsedWcOrder;
use App\Enums\WcOrderStatus;
use App\Models\Branch;
use App\Models\Party;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WcOrderItem;
use App\Models\WooCommerceIntegration;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class WcOrderIngestionService
{
    public function __construct(
        protected WcOrderPayloadParser $parser,
        protected WcOrderLineItemMapper $lineItemMapper,
        protected WooCommerceCustomerSyncService $customerSyncService
    ) {}

    public function ingest(User $user, array $wcOrderData): WcOrder
    {
        $accountId = $user->getAccountId();
        $parsed = $this->parser->parse($wcOrderData);

        $existing = WcOrder::where('user_id', $accountId)
            ->where('wc_order_id', $parsed->wcOrderId)
            ->first();

        if ($existing) {
            return $this->updateExisting($accountId, $existing, $parsed);
        }

        return $this->createNew($user, $accountId, $parsed);
    }

    private function updateExisting(int $accountId, WcOrder $existing, ParsedWcOrder $parsed): WcOrder
    {
        return DB::transaction(function () use ($accountId, $existing, $parsed) {
            $locked = WcOrder::where('user_id', $accountId)
                ->lockForUpdate()
                ->findOrFail($existing->id);

            $updates = $this->collectFieldUpdates($locked, $parsed);
            $cancellationUpdates = $this->syncCancellation($locked, $parsed->status);
            $updates = array_merge($updates, $cancellationUpdates);

            if (!empty($updates)) {
                $locked->update($updates);
            }

            return $locked;
        });
    }

    private function collectFieldUpdates(WcOrder $locked, ParsedWcOrder $parsed): array
    {
        $updates = [];
        if ($parsed->orderDate) {
            $updates['order_date'] = $parsed->orderDate;
        }
        if (empty($locked->customer_phone) && $parsed->customerPhone) {
            $updates['customer_phone'] = $parsed->customerPhone;
        }
        if (empty($locked->customer_address) && $parsed->customerAddress) {
            $updates['customer_address'] = $parsed->customerAddress;
        }
        if (empty($locked->governorate) && !empty($parsed->governorate)) {
            $updates['governorate'] = $parsed->governorate;
        }
        if (empty($locked->city) && !empty($parsed->city)) {
            $updates['city'] = $parsed->city;
        }

        $existingItems = $locked->items_snapshot ?? [];
        $needsItemEnrichment = empty($existingItems) || !isset($existingItems[0]['image_url']);
        if ($needsItemEnrichment && !empty($parsed->rawLineItems)) {
            [$products, $variants] = $this->lineItemMapper->mapCatalog($locked->user_id, $parsed->rawLineItems);
            $updates['items_snapshot'] = $this->lineItemMapper->enrich($locked->user_id, $parsed->rawLineItems, $products, $variants);
        }

        return $updates;
    }

    /**
     * @return array<string, mixed>
     */
    private function syncCancellation(WcOrder $locked, string $incomingStatus): array
    {
        if ($incomingStatus !== 'cancelled') {
            return [];
        }

        $updates = [];
        if ($locked->status->canTransitionTo(WcOrderStatus::CANCELLED)) {
            $updates['status'] = WcOrderStatus::CANCELLED;
            $cancelTag = '[تم إلغاء الطلب من WooCommerce]';
            if (!str_contains($locked->notes ?? '', $cancelTag)) {
                $updates['notes'] = ($locked->notes ? $locked->notes . ' | ' : '') . $cancelTag;
            }
        } elseif (!in_array($locked->status, [WcOrderStatus::CANCELLED, WcOrderStatus::RETURNED], true)) {
            $warningTag = "[تحذير: تم إلغاء الطلب من WooCommerce ولكن حالته بالنظام '{$locked->status->label()}']";
            if (!str_contains($locked->notes ?? '', $warningTag)) {
                $updates['notes'] = ($locked->notes ? $locked->notes . ' | ' : '') . $warningTag;
            }
        }

        return $updates;
    }

    private function createNew(User $user, int $accountId, ParsedWcOrder $parsed): WcOrder
    {
        return DB::transaction(function () use ($user, $accountId, $parsed) {
            $party = $this->syncParty($user, $parsed);
            $branchId = $this->resolveBranchId($accountId);

            [$products, $variants] = $this->lineItemMapper->mapCatalog($accountId, $parsed->rawLineItems);
            $itemsSnapshot = $this->lineItemMapper->enrich($accountId, $parsed->rawLineItems, $products, $variants);

            $wcOrder = WcOrder::create(
                $this->buildOrderAttributes($accountId, $parsed, $party, $branchId, $itemsSnapshot)
            );

            $this->createOrderItems($accountId, $wcOrder->id, $parsed->rawLineItems, $products, $variants);

            return $wcOrder;
        });
    }

    private function resolveBranchId(int $accountId): ?int
    {
        $integration = WooCommerceIntegration::withoutGlobalScopes()
            ->where('user_id', $accountId)
            ->first();

        if (!empty($integration?->online_branch_id)) {
            return $integration->online_branch_id;
        }

        return Branch::where('user_id', $accountId)->where('is_main', true)->value('id')
            ?? Branch::where('user_id', $accountId)->value('id');
    }

    private function syncParty(User $user, ParsedWcOrder $parsed): ?Party
    {
        return $this->customerSyncService->syncCustomerFromWooCommerce($user, [
            'id' => $parsed->customerId,
            'billing' => $parsed->billing,
            'shipping' => $parsed->shipping,
            'first_name' => $parsed->billing['first_name'] ?? ($parsed->shipping['first_name'] ?? ''),
            'last_name' => $parsed->billing['last_name'] ?? ($parsed->shipping['last_name'] ?? ''),
            'phone' => $parsed->customerPhone ?: ($parsed->billing['phone'] ?? ($parsed->shipping['phone'] ?? '')),
            'email' => $parsed->billing['email'] ?? null,
        ]);
    }

    private function buildOrderAttributes(
        int $accountId,
        ParsedWcOrder $parsed,
        ?Party $party,
        ?int $branchId,
        array $itemsSnapshot
    ): array {
        return [
            'user_id' => $accountId,
            'wc_order_id' => $parsed->wcOrderId,
            'order_date' => $parsed->orderDate,
            'party_id' => $party?->id,
            'branch_id' => $branchId,
            'tracking_number' => $parsed->trackingNumber,
            'courier_name' => $parsed->courierName,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'payment_status' => $parsed->paymentStatus,
            'wc_payment_method' => $parsed->paymentMethod,
            'shipping_cost' => $parsed->shippingCost->getAmount(),
            'subtotal' => $parsed->subtotal->getAmount(),
            'discount_total' => $parsed->discountTotal->getAmount(),
            'total' => $parsed->total->getAmount(),
            'customer_name' => $parsed->customerName ?: ($party?->name ?? 'عميل أونلاين'),
            'customer_phone' => $parsed->customerPhone ?: ($party?->phone ?? null),
            'customer_email' => $parsed->customerEmail ?? $party?->wc_email,
            'customer_address' => $parsed->customerAddress ?: ($party?->address ?? null),
            'governorate' => $parsed->governorate,
            'city' => $parsed->city,
            'notes' => $parsed->notes,
            'wc_coupon_codes' => $parsed->couponCodes,
            'items_snapshot' => $itemsSnapshot,
        ];
    }

    private function createOrderItems(
        int $accountId,
        int $wcOrderId,
        array $rawLineItems,
        Collection $products,
        Collection $variants
    ): void {
        $rows = $this->lineItemMapper->buildItemRows($accountId, $wcOrderId, $rawLineItems, $products, $variants);
        foreach ($rows as $row) {
            WcOrderItem::create($row);
        }
    }
}
