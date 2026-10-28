<?php

namespace App\Jobs;

use App\Contracts\WooCommerceApiClientInterface;
use App\Models\WooCommerceIntegration;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class SyncOrderStatusToWooCommerceJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 25;
    public array $backoff = [10, 60];

    public function __construct(
        public int $userId,
        public int $wcOrderId,
        public string $status
    ) {}

    public function handle(WooCommerceApiClientInterface $apiClient): void
    {
        $integration = WooCommerceIntegration::where('user_id', $this->userId)
            ->where('is_active', true)
            ->first();

        if (!$integration) {
            return;
        }

        try {
            $apiClient->updateOrderStatus($integration, $this->wcOrderId, $this->status);
        } catch (Throwable $e) {
            Log::warning("Failed to sync order status to WooCommerce for order #{$this->wcOrderId}: " . $e->getMessage());
            throw $e;
        }
    }
}
