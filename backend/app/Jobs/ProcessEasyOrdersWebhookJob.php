<?php

namespace App\Jobs;

use App\Contracts\EasyOrdersApiClientInterface;
use App\Enums\EcommercePlatform;
use App\Enums\OrderCancelReason;
use App\Enums\QueueName;
use App\Enums\WcOrderStatus;
use App\Exceptions\EasyOrdersConnectionException;
use App\Jobs\Middleware\WithTenantContext;
use App\Models\EasyOrdersIntegration;
use App\Models\OnlineOrder;
use App\Models\User;
use App\Services\EasyOrders\EasyOrdersStatusMap;
use App\Services\OnlineOrders\OnlineOrderIngestionService;
use App\Services\OnlineOrders\OnlineOrderSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessEasyOrdersWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 4;
    public int $timeout = 45;
    public array $backoff = [15, 60, 120];

    public function __construct(
        public int $userId,
        public string $topic,
        public array $payload
    ) {
        $this->onQueue(QueueName::EASYORDERS_REALTIME->value);
    }

    public function middleware(): array
    {
        return [new WithTenantContext($this->userId)];
    }

    public function handle(
        OnlineOrderIngestionService $ingestionService,
        OnlineOrderSyncService $syncService,
        EasyOrdersApiClientInterface $apiClient
    ): void {
        $user = User::withoutGlobalScopes()->findOrFail($this->userId);
        $integration = EasyOrdersIntegration::withoutGlobalScopes()
            ->where('user_id', $this->userId)
            ->where('is_active', true)
            ->first();

        try {
            $this->topic === 'order-status-update'
                ? $this->handleStatusUpdate($user, $integration, $ingestionService, $syncService, $apiClient)
                : $this->handleOrderPayload($user, $integration, $ingestionService, $apiClient);
        } catch (EasyOrdersConnectionException $e) {
            if ($e->isRateLimited() && $this->attempts() < $this->tries) {
                $this->release($e->retryAfterSeconds > 0 ? $e->retryAfterSeconds : 60);
                return;
            }
            throw $e;
        }
    }

    private function handleOrderPayload(User $user, ?EasyOrdersIntegration $integration, OnlineOrderIngestionService $ingestionService, EasyOrdersApiClientInterface $apiClient): void
    {
        $orderData = $this->payload;
        $orderId = (string) ($orderData['id'] ?? '');
        if ($orderId === '') {
            return;
        }

        if ($this->needsFullOrderHydration($orderData) && $integration && !empty($integration->api_key)) {
            $orderData = $apiClient->getOrderById($integration, $orderId);
        }

        $ingestionService->ingest($user, EcommercePlatform::EASYORDERS, $orderData);
    }

    private function handleStatusUpdate(User $user, ?EasyOrdersIntegration $integration, OnlineOrderIngestionService $ingestionService, OnlineOrderSyncService $syncService, EasyOrdersApiClientInterface $apiClient): void
    {
        $orderId = (string) ($this->payload['order_id'] ?? ($this->payload['id'] ?? ''));
        $rawStatus = (string) ($this->payload['new_status'] ?? ($this->payload['status'] ?? ''));
        if ($orderId === '' || EasyOrdersStatusMap::normalize($rawStatus) === '') {
            return;
        }

        $existing = OnlineOrder::where('user_id', $user->getAccountId())
            ->where('platform', EcommercePlatform::EASYORDERS->value)
            ->where('external_order_id', $orderId)
            ->first();

        if (!$existing) {
            if ($integration && !empty($integration->api_key)) {
                $ingestionService->ingest($user, EcommercePlatform::EASYORDERS, $apiClient->getOrderById($integration, $orderId));
            }
            return;
        }

        if (EasyOrdersStatusMap::isCancelled($rawStatus) && !in_array($existing->status, [WcOrderStatus::CANCELLED, WcOrderStatus::RETURNED], true)) {
            $syncService->cancelOrder($user, $existing, OrderCancelReason::CUSTOMER_REJECTED, 'تم التحديث من متجر EasyOrders');
        }
    }

    private function needsFullOrderHydration(array $orderData): bool
    {
        $items = $orderData['cart_items'] ?? [];
        if (empty($items) || !is_array($items)) {
            return true;
        }

        return empty($items[0]['product'] ?? null);
    }
}
