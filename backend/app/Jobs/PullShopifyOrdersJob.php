<?php

namespace App\Jobs;

use App\Enums\EcommercePlatform;
use App\Enums\QueueName;
use App\Models\ShopifyIntegration;
use App\Models\User;
use App\Services\OnlineOrders\OnlineOrderSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PullShopifyOrdersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 300;

    public function __construct(
        public int $accountId,
        public int $actingUserId,
        public int $limit = 25
    ) {
        $this->onQueue(QueueName::SHOPIFY_BULK->value);
    }

    public function handle(OnlineOrderSyncService $syncService): int
    {
        $user = User::withoutGlobalScopes()->findOrFail($this->actingUserId);
        ShopifyIntegration::withoutGlobalScopes()
            ->where('user_id', $this->accountId)
            ->where('is_active', true)
            ->firstOrFail();

        return $syncService->pullRecentOrders($user, EcommercePlatform::SHOPIFY, $this->limit)['total'];
    }
}
