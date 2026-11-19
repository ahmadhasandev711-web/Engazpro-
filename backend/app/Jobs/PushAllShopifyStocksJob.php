<?php

namespace App\Jobs;

use App\Enums\QueueName;
use App\Jobs\Middleware\WithTenantContext;
use App\Models\ShopifyIntegration;
use App\Models\User;
use App\Services\Shopify\ShopifyBulkStockPushService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PushAllShopifyStocksJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 900;

    public function __construct(
        public int $accountId,
        public int $actingUserId
    ) {
        $this->onQueue(QueueName::SHOPIFY_BULK->value);
    }

    public function middleware(): array
    {
        return [new WithTenantContext($this->actingUserId)];
    }

    public function handle(ShopifyBulkStockPushService $bulkPushService): array
    {
        $user = User::withoutGlobalScopes()->findOrFail($this->actingUserId);
        $integration = ShopifyIntegration::withoutGlobalScopes()
            ->where('user_id', $this->accountId)
            ->where('is_active', true)
            ->firstOrFail();

        try {
            return $bulkPushService->pushAll($user, $integration);
        } catch (\Throwable $e) {
            Log::error('PushAllShopifyStocksJob failed', ['account_id' => $this->accountId, 'exception' => $e]);
            throw $e;
        }
    }
}
