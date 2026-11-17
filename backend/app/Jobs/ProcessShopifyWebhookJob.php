<?php

namespace App\Jobs;

use App\Enums\EcommercePlatform;
use App\Enums\QueueName;
use App\Models\User;
use App\Services\OnlineOrders\OnlineOrderIngestionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessShopifyWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 45;
    public array $backoff = [15, 60];

    public function __construct(
        public int $userId,
        public string $topic,
        public array $payload
    ) {
        $this->onQueue(QueueName::SHOPIFY_REALTIME->value);
    }

    public function handle(OnlineOrderIngestionService $ingestionService): void
    {
        $user = User::withoutGlobalScopes()->findOrFail($this->userId);
        if (str_starts_with($this->topic, 'orders/')) {
            $ingestionService->ingest($user, EcommercePlatform::SHOPIFY, $this->payload);
        }
    }
}
