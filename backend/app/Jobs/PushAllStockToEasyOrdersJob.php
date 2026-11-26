<?php

namespace App\Jobs;

use App\Enums\QueueName;
use App\Exceptions\EasyOrdersConnectionException;
use App\Jobs\Middleware\WithTenantContext;
use App\Models\EasyOrdersIntegration;
use App\Services\EasyOrders\EasyOrdersBulkStockPushService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PushAllStockToEasyOrdersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 120;
    public array $backoff = [30, 60];

    public function __construct(
        public int $userId
    ) {
        $this->onQueue(QueueName::EASYORDERS_BULK->value);
    }

    public function middleware(): array
    {
        return [new WithTenantContext($this->userId)];
    }

    public function handle(EasyOrdersBulkStockPushService $bulkService): void
    {
        $integration = EasyOrdersIntegration::withoutGlobalScopes()->where('user_id', $this->userId)->where('is_active', true)->first();
        if (!$integration) {
            return;
        }

        try {
            $bulkService->pushAllLinked($integration);
        } catch (EasyOrdersConnectionException $e) {
            $integration->update(['last_error' => $e->getMessage()]);
            if ($e->isRateLimited() && $this->attempts() < $this->tries) {
                $this->release($e->retryAfterSeconds > 0 ? $e->retryAfterSeconds : 60);
                return;
            }
            throw $e;
        }
    }
}
