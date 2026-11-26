<?php

namespace App\Jobs;

use App\Contracts\EasyOrdersApiClientInterface;
use App\Enums\QueueName;
use App\Exceptions\EasyOrdersConnectionException;
use App\Jobs\Middleware\WithTenantContext;
use App\Models\EasyOrdersIntegration;
use App\Models\OnlineOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SyncStatusToEasyOrdersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 4;
    public int $timeout = 25;
    public array $backoff = [15, 60, 120];

    public function __construct(
        public int $userId,
        public int $onlineOrderId,
        public string $targetStatus
    ) {
        $this->onQueue(QueueName::EASYORDERS_REALTIME->value);
    }

    public function middleware(): array
    {
        return [new WithTenantContext($this->userId)];
    }

    public function handle(EasyOrdersApiClientInterface $apiClient): void
    {
        $integration = EasyOrdersIntegration::withoutGlobalScopes()
            ->where('user_id', $this->userId)
            ->where('is_active', true)
            ->first();

        $order = $integration ? OnlineOrder::withoutGlobalScopes()->where('user_id', $this->userId)->find($this->onlineOrderId) : null;
        if (!$integration || !$order || empty($integration->api_key)) {
            return;
        }

        try {
            $apiClient->updateOrderStatus($integration, $order->external_order_id, $this->targetStatus);
        } catch (EasyOrdersConnectionException $e) {
            if ($e->isRateLimited() && $this->attempts() < $this->tries) {
                $this->release($e->retryAfterSeconds > 0 ? $e->retryAfterSeconds : 60);
                return;
            }
            $integration->update(['last_error' => $e->getMessage()]);
        }
    }
}
