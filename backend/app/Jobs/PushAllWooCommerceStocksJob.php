<?php

namespace App\Jobs;

use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WooCommerceBulkStockPushService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PushAllWooCommerceStocksJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    /** Must stay below config('queue.connections.database.retry_after'). */
    public int $timeout = 900;

    public function __construct(
        public int $accountId,
        public int $actingUserId
    ) {}

    /**
     * @return array{synced_count: int, total_linked_products: int, errors: list<string>}
     */
    public function handle(WooCommerceBulkStockPushService $bulkStockPushService): array
    {
        $user = User::withoutGlobalScopes()->findOrFail($this->actingUserId);
        $integration = WooCommerceIntegration::withoutGlobalScopes()
            ->where('user_id', $this->accountId)
            ->where('is_active', true)
            ->firstOrFail();

        if (!$integration->consumer_key || !$integration->consumer_secret) {
            throw new \RuntimeException('WooCommerce integration keys are not configured.');
        }

        try {
            return $bulkStockPushService->pushAll($user, $integration);
        } catch (\Throwable $e) {
            Log::error('PushAllWooCommerceStocksJob failed', [
                'account_id' => $this->accountId,
                'acting_user_id' => $this->actingUserId,
                'exception' => $e,
            ]);
            throw $e;
        }
    }
}
