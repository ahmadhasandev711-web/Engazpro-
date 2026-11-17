<?php

namespace App\Jobs;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\OrderCancelReason;
use App\Enums\QueueName;
use App\Models\OnlineOrder;
use App\Models\ShopifyIntegration;
use App\Services\Shopify\ShopifyStockSyncGate;
use App\Support\ShopifyGid;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class CancelShopifyOrderJob implements ShouldQueue
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
        $order = OnlineOrder::withoutGlobalScopes()->where('user_id', $this->userId)->find($this->localOrderId);

        if (!$integration || !$order || !$order->external_order_id) {
            return;
        }

        $reason = $order->cancel_reason ?? OrderCancelReason::OTHER;
        $noteParts = array_filter([$reason->label(), $order->cancel_notes]);
        $staffNote = !empty($noteParts) ? implode(' - ', $noteParts) : null;

        $graphqlClient->cancelOrder(
            $integration,
            ShopifyGid::toGid('Order', (int) $order->external_order_id),
            $reason->toShopifyReason(),
            !ShopifyStockSyncGate::isActive($this->userId),
            $staffNote
        );
    }
}
