<?php

namespace App\Services\OnlineOrders;

use App\Contracts\StorePlatformOrderAdapterInterface;
use App\DTOs\ParsedOnlineOrder;
use App\Enums\EcommercePlatform;
use App\Enums\WcOrderStatus;
use App\Models\OnlineOrder;
use App\Models\OnlineOrderItem;
use App\Models\Party;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class OnlineOrderIngestionService
{
    public function __construct(
        private readonly StoreOrderAdapterRegistry $adapters,
    ) {}

    public function ingest(User $user, EcommercePlatform $platform, array $rawOrderData): OnlineOrder
    {
        $accountId = $user->getAccountId();
        $adapter = $this->adapters->forPlatform($platform);
        $parsed = $adapter->parsePayload($rawOrderData);

        $existing = OnlineOrder::where('user_id', $accountId)
            ->where('platform', $platform->value)
            ->where('external_order_id', $parsed->externalOrderId)
            ->first();

        return $existing
            ? $this->updateExisting($accountId, $existing, $parsed, $adapter)
            : $this->createNew($user, $accountId, $parsed, $adapter);
    }

    private function updateExisting(
        int $accountId,
        OnlineOrder $existing,
        ParsedOnlineOrder $parsed,
        StorePlatformOrderAdapterInterface $adapter
    ): OnlineOrder {
        return DB::transaction(function () use ($accountId, $existing, $parsed, $adapter) {
            $locked = OnlineOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($existing->id);
            $updates = $this->collectUpdates($locked, $parsed, $adapter);
            if ($parsed->isCancelled) {
                $updates = array_merge($updates, $this->buildCancellationUpdates($locked, $parsed->platform));
            }
            if (!empty($updates)) {
                $locked->update($updates);
            }

            return $locked;
        });
    }

    private function collectUpdates(
        OnlineOrder $locked,
        ParsedOnlineOrder $parsed,
        StorePlatformOrderAdapterInterface $adapter
    ): array {
        $updates = array_filter([
            'order_date' => $parsed->orderDate,
            'customer_phone' => empty($locked->customer_phone) ? $parsed->customerPhone : null,
            'customer_address' => empty($locked->customer_address) ? $parsed->customerAddress : null,
            'governorate' => empty($locked->governorate) ? $parsed->governorate : null,
            'city' => empty($locked->city) ? $parsed->city : null,
        ], fn ($v) => $v !== null);

        if (!empty($parsed->platformMeta)) {
            $updates['platform_meta'] = array_merge($locked->platform_meta ?? [], $parsed->platformMeta);
        }
        $existingItems = $locked->items_snapshot ?? [];
        if ((empty($existingItems) || !isset($existingItems[0]['image_url'])) && !empty($parsed->rawLineItems)) {
            $updates['items_snapshot'] = $adapter->mapOrderItems($locked->user_id, $parsed)['snapshot'];
        }

        return $updates;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildCancellationUpdates(OnlineOrder $locked, EcommercePlatform $platform): array
    {
        $name = $platform->label();
        if ($locked->status->canTransitionTo(WcOrderStatus::CANCELLED)) {
            $tag = "[تم إلغاء الطلب من {$name}]";

            return ['status' => WcOrderStatus::CANCELLED, 'notes' => $this->appendNoteTag($locked->notes, $tag)];
        }
        if (!in_array($locked->status, [WcOrderStatus::CANCELLED, WcOrderStatus::RETURNED], true)) {
            $warn = "[تحذير: تم إلغاء الطلب من {$name} ولكن حالته بالنظام '{$locked->status->label()}']";

            return ['notes' => $this->appendNoteTag($locked->notes, $warn)];
        }

        return [];
    }

    private function appendNoteTag(?string $notes, string $tag): string
    {
        if (str_contains($notes ?? '', $tag)) {
            return (string) $notes;
        }

        return trim(($notes ? $notes . ' | ' : '') . $tag);
    }

    private function createNew(
        User $user,
        int $accountId,
        ParsedOnlineOrder $parsed,
        StorePlatformOrderAdapterInterface $adapter
    ): OnlineOrder {
        return DB::transaction(function () use ($user, $accountId, $parsed, $adapter) {
            $party = $adapter->syncCustomer($user, $parsed);
            $branchId = $adapter->resolveBranchId($accountId, $parsed);
            $mapped = $adapter->mapOrderItems($accountId, $parsed);

            $order = OnlineOrder::create(
                $this->buildOrderAttributes($accountId, $parsed, $party, $branchId, $mapped['snapshot'])
            );

            foreach ($mapped['item_rows'] as $row) {
                $row['online_order_id'] = $order->id;
                OnlineOrderItem::create($row);
            }

            return $order;
        });
    }

    private function buildOrderAttributes(
        int $accountId,
        ParsedOnlineOrder $parsed,
        ?Party $party,
        ?int $branchId,
        array $snapshot
    ): array {
        return [
            'user_id' => $accountId, 'platform' => $parsed->platform,
            'external_order_id' => $parsed->externalOrderId, 'external_order_number' => $parsed->externalOrderNumber,
            'order_date' => $parsed->orderDate, 'party_id' => $party?->id, 'branch_id' => $branchId,
            'tracking_number' => $parsed->trackingNumber, 'courier_name' => $parsed->courierName,
            'status' => $parsed->isCancelled ? WcOrderStatus::CANCELLED : WcOrderStatus::PENDING_CONFIRMATION,
            'payment_status' => $parsed->paymentStatus, 'payment_method_label' => $parsed->paymentMethodLabel,
            'shipping_cost' => $parsed->shippingCost->getAmount(), 'subtotal' => $parsed->subtotal->getAmount(),
            'discount_total' => $parsed->discountTotal->getAmount(), 'total' => $parsed->total->getAmount(),
            'customer_name' => $parsed->customerName ?: ($party?->name ?? 'عميل أونلاين'),
            'customer_phone' => $parsed->customerPhone ?: $party?->phone,
            'customer_email' => $parsed->customerEmail ?? $party?->wc_email,
            'customer_address' => $parsed->customerAddress ?: $party?->address,
            'governorate' => $parsed->governorate, 'city' => $parsed->city, 'notes' => $parsed->notes,
            'coupon_codes' => $parsed->couponCodes, 'discount_breakdown' => $parsed->discountBreakdown,
            'items_snapshot' => $snapshot, 'platform_meta' => $parsed->platformMeta,
        ];
    }
}
