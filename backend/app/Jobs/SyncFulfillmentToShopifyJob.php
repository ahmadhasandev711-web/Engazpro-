<?php

namespace App\Jobs;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\QueueName;
use App\Models\ShopifyIntegration;
use App\Models\ShopifyOrder;
use App\Support\ShopifyGid;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SyncFulfillmentToShopifyJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 30;
    public array $backoff = [15, 60];

    public function __construct(
        public int $userId,
        public int $localOrderId
    ) {
        $this->onQueue(QueueName::SHOPIFY_REALTIME->value);
    }

    public function handle(ShopifyGraphqlClientInterface $graphqlClient): void
    {
        $integration = ShopifyIntegration::withoutGlobalScopes()
            ->where('user_id', $this->userId)->where('is_active', true)->first();
        $order = ShopifyOrder::withoutGlobalScopes()->where('user_id', $this->userId)->find($this->localOrderId);

        if (!$integration || !$order || !$order->shopify_order_id) {
            return;
        }

        $fulfillmentOrders = $graphqlClient->getOrderFulfillmentOrders(
            $integration,
            ShopifyGid::toGid('Order', $order->shopify_order_id)
        );
        $lineItemsByFo = $this->collectOpenFulfillmentOrderItems($fulfillmentOrders);
        if (empty($lineItemsByFo)) {
            return;
        }

        $input = ['lineItemsByFulfillmentOrder' => $lineItemsByFo, 'notifyCustomer' => false];
        if (!empty($order->courier_name) || !empty($order->tracking_number)) {
            $input['trackingInfo'] = array_filter([
                'company' => $order->courier_name,
                'number' => $order->tracking_number,
            ]);
        }

        $graphqlClient->createFulfillment($integration, $input);
    }

    private function collectOpenFulfillmentOrderItems(array $fulfillmentOrders): array
    {
        $result = [];
        foreach ($fulfillmentOrders as $fo) {
            if (!in_array(strtolower((string) ($fo['status'] ?? '')), ['open', 'in_progress', 'scheduled'], true)) {
                continue;
            }
            $items = collect($fo['lineItems']['edges'] ?? [])->pluck('node')
                ->filter(fn ($n) => (int) ($n['remainingQuantity'] ?? 0) > 0)
                ->map(fn ($n) => ['id' => $n['id'], 'quantity' => (int) $n['remainingQuantity']])
                ->values()->all();

            if (!empty($items)) {
                $result[] = ['fulfillmentOrderId' => $fo['id'], 'fulfillmentOrderLineItems' => $items];
            }
        }

        return $result;
    }
}
