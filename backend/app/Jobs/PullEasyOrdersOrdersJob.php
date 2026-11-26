<?php

namespace App\Jobs;

use App\Enums\EcommercePlatform;
use App\Enums\QueueName;
use App\Exceptions\EasyOrdersConnectionException;
use App\Jobs\Middleware\WithTenantContext;
use App\Models\EasyOrdersIntegration;
use App\Models\User;
use App\Services\OnlineOrders\OnlineOrderSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PullEasyOrdersOrdersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 90;
    public array $backoff = [30, 60];

    public function __construct(
        public int $accountId,
        public int $initiatedByUserId,
        public int $limit = 30
    ) {
        $this->onQueue(QueueName::EASYORDERS_BULK->value);
    }

    public function middleware(): array
    {
        return [new WithTenantContext($this->accountId)];
    }

    public function handle(OnlineOrderSyncService $syncService): int
    {
        $user = User::withoutGlobalScopes()->findOrFail($this->accountId);

        try {
            return $syncService->pullRecentOrders($user, EcommercePlatform::EASYORDERS, $this->limit)['total'];
        } catch (EasyOrdersConnectionException $e) {
            EasyOrdersIntegration::withoutGlobalScopes()->where('user_id', $this->accountId)->update(['last_error' => $e->getMessage()]);
            if ($e->isRateLimited() && $this->attempts() < $this->tries) {
                $this->release($e->retryAfterSeconds > 0 ? $e->retryAfterSeconds : 60);
                return 0;
            }
            throw $e;
        }
    }
}
