<?php

namespace App\Jobs;

use App\Enums\QueueName;
use App\Jobs\Middleware\WithTenantContext;
use App\Models\User;
use App\Services\WooCommerce\WooCommerceOrderSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessWooCommerceWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 60;
    public array $backoff = [5, 15, 30];

    public function __construct(
        public int $userId,
        public ?string $topic,
        public array $payload
    ) {
        $this->onQueue(QueueName::WOO_REALTIME->value);
    }

    public function middleware(): array
    {
        return [new WithTenantContext($this->userId)];
    }

    public function handle(WooCommerceOrderSyncService $orderSyncService): void
    {
        $user = User::withoutGlobalScopes()->find($this->userId);
        if (!$user) {
            Log::warning("ProcessWooCommerceWebhookJob: User #{$this->userId} not found.");
            return;
        }

        if (!empty($this->payload['id'])) {
            $orderSyncService->handleIncomingOrder($user, $this->payload);
        }
    }
}
