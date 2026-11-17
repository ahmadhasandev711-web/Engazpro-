<?php

namespace App\Services\Anoofy\Handlers;

use App\Contracts\AnoofyEventHandlerInterface;
use App\DTOs\AnoofyEnvelope;
use App\DTOs\HandlerOutcome;
use App\Enums\AnoofyEventResult;
use App\Enums\EcommercePlatform;
use App\Enums\WcOrderStatus;
use App\Exceptions\OrderNotYetSyncedException;
use App\Jobs\PushStockToWooCommerceJob;
use App\Models\OnlineOrder;
use App\Models\OnlineOrderItem;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WcOrderLineItemMapper;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class OrderConfirmedHandler implements AnoofyEventHandlerInterface
{
    public function __construct(
        private readonly WcOrderLineItemMapper $lineItemMapper,
    ) {
    }

    public function handle(WooCommerceIntegration $integration, AnoofyEnvelope $envelope): HandlerOutcome
    {
        $wcOrderId = (int) ($envelope->data['wc_order_id'] ?? 0);
        $order = OnlineOrder::where('user_id', $integration->user_id)
            ->where('platform', EcommercePlatform::WOOCOMMERCE->value)
            ->where('external_order_id', (string) $wcOrderId)
            ->first();

        if ($order === null) {
            throw new OrderNotYetSyncedException();
        }

        $earlyOutcome = $this->checkEarlyExits($integration, $order, $envelope);
        if ($earlyOutcome !== null) {
            return $earlyOutcome;
        }

        return $this->processConfirmation($integration, $order, $envelope);
    }

    private function checkEarlyExits(
        WooCommerceIntegration $integration,
        OnlineOrder $order,
        AnoofyEnvelope $envelope
    ): ?HandlerOutcome {
        $currentVersion = $order->meta('anoofy_order_version');
        if ($envelope->orderVersion !== null && $currentVersion !== null && $envelope->orderVersion <= (int) $currentVersion) {
            return new HandlerOutcome(AnoofyEventResult::STALE);
        }

        $confirmedAt = CarbonImmutable::parse((string) ($envelope->data['confirmed_at'] ?? $envelope->occurredAt));
        if ($integration->anoofy_connected_at !== null && $confirmedAt->lessThan($integration->anoofy_connected_at)) {
            return new HandlerOutcome(AnoofyEventResult::IGNORED, 'before_connection');
        }

        if ($order->status !== WcOrderStatus::PENDING_CONFIRMATION) {
            return new HandlerOutcome(AnoofyEventResult::IGNORED, $order->status->value);
        }

        return null;
    }

    protected function onBeforeLock(OnlineOrder $order): void
    {
    }

    private function processConfirmation(
        WooCommerceIntegration $integration,
        OnlineOrder $order,
        AnoofyEnvelope $envelope
    ): HandlerOutcome {
        $this->onBeforeLock($order);

        return DB::transaction(function () use ($integration, $order, $envelope) {
            $locked = OnlineOrder::where('id', $order->id)->lockForUpdate()->firstOrFail();

            $earlyOutcome = $this->checkEarlyExits($integration, $locked, $envelope);
            if ($earlyOutcome !== null) {
                return $earlyOutcome;
            }

            $this->applyOrderUpdates($integration->user_id, $locked, $envelope);
            $locked->save();

            return new HandlerOutcome(AnoofyEventResult::PROCESSED);
        });
    }

    private function applyOrderUpdates(int $userId, OnlineOrder $locked, AnoofyEnvelope $envelope): void
    {
        $confirmedAt = CarbonImmutable::parse((string) ($envelope->data['confirmed_at'] ?? $envelope->occurredAt));
        $locked->call_confirmed_at = $confirmedAt;
        $locked->call_confirmed_by = (string) ($envelope->data['confirmed_by_name'] ?? '');
        if ($envelope->orderVersion !== null) {
            $meta = $locked->platform_meta ?? [];
            $meta['anoofy_order_version'] = $envelope->orderVersion;
            $locked->platform_meta = $meta;
        }

        $this->updateCustomerDetails($locked, (array) ($envelope->data['customer'] ?? []));

        if (isset($envelope->data['line_items']) && is_array($envelope->data['line_items'])) {
            $this->syncLineItems($userId, $locked, $envelope->data['line_items']);
        }
    }

    private function updateCustomerDetails(OnlineOrder $order, array $customer): void
    {
        if (empty($customer)) {
            return;
        }

        if (!empty($customer['phone'])) {
            $order->customer_phone = (string) $customer['phone'];
        }
        if (!empty($customer['address_1'])) {
            $addr = (string) $customer['address_1'];
            if (!empty($customer['address_2'])) {
                $addr .= ' - ' . trim((string) $customer['address_2']);
            }
            $order->customer_address = $addr;
        }
        if (!empty($customer['city'])) {
            $order->city = (string) $customer['city'];
        }
        if (!empty($customer['state'])) {
            $order->governorate = (string) $customer['state'];
        }
    }

    private function syncLineItems(int $userId, OnlineOrder $order, array $rawItems): void
    {
        $oldPairs = OnlineOrderItem::where('online_order_id', $order->id)
            ->whereNotNull('product_id')
            ->get(['product_id', 'product_variant_id'])
            ->map(fn ($it) => [$it->product_id, $it->product_variant_id])
            ->all();

        $normalized = $this->normalizeLineItems($rawItems);
        [$products, $variants] = $this->lineItemMapper->mapCatalog($userId, $normalized);

        $order->items_snapshot = $this->lineItemMapper->enrich($userId, $normalized, $products, $variants);
        $this->recalculateOrderTotals($order, $normalized);

        OnlineOrderItem::where('online_order_id', $order->id)->delete();
        $newRows = $this->lineItemMapper->buildItemRows($userId, $order->id, $normalized, $products, $variants);
        $this->persistOnlineOrderItems($order->id, $newRows);

        $newPairs = array_filter(
            array_map(fn ($r) => [$r['product_id'], $r['product_variant_id']], $newRows),
            fn ($p) => !empty($p[0])
        );

        $this->dispatchStockPushJobs($userId, array_merge($oldPairs, $newPairs));
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function persistOnlineOrderItems(int $orderId, array $rows): void
    {
        foreach ($rows as $row) {
            OnlineOrderItem::create([
                'user_id' => $row['user_id'],
                'online_order_id' => $orderId,
                'product_id' => $row['product_id'],
                'product_variant_id' => $row['product_variant_id'],
                'external_product_id' => !empty($row['wc_product_id']) ? (string) $row['wc_product_id'] : null,
                'external_variant_id' => !empty($row['wc_variation_id']) ? (string) $row['wc_variation_id'] : null,
                'quantity' => $row['quantity'],
            ]);
        }
    }

    private function recalculateOrderTotals(OnlineOrder $order, array $items): void
    {
        $subtotal = Money::zero();
        foreach ($items as $item) {
            $subtotal = $subtotal->add(Money::of($item['total'] ?? 0));
        }

        $shipping = Money::of($order->shipping_cost ?? 0);
        $discount = Money::of($order->discount_total ?? 0);
        $total = $subtotal->add($shipping)->subtract($discount);

        $order->subtotal = $subtotal->getAmount();
        $order->total = $total->getAmount();
    }

    private function normalizeLineItems(array $rawItems): array
    {
        return array_map(function (array $it): array {
            return [
                'product_id' => $it['wc_product_id'] ?? $it['product_id'] ?? 0,
                'variation_id' => $it['wc_variation_id'] ?? $it['variation_id'] ?? null,
                'quantity' => $it['quantity'] ?? 1,
                'name' => $it['name'] ?? '',
                'price' => $it['price'] ?? 0,
                'total' => $it['total'] ?? 0,
                'subtotal' => $it['subtotal'] ?? $it['total'] ?? 0,
                'sku' => $it['sku'] ?? null,
                'meta_data' => $it['meta_data'] ?? [],
            ];
        }, $rawItems);
    }

    private function dispatchStockPushJobs(int $userId, array $pairs): void
    {
        $uniquePairs = [];
        foreach ($pairs as [$pid, $vid]) {
            if (!empty($pid)) {
                $key = "{$pid}:" . ($vid ?? 'null');
                $uniquePairs[$key] = [(int) $pid, $vid ? (int) $vid : null];
            }
        }

        foreach ($uniquePairs as [$pid, $vid]) {
            PushStockToWooCommerceJob::dispatch($userId, $pid, $vid)->afterCommit();
        }
    }
}
