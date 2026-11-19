<?php

namespace App\Jobs;

use App\Enums\EcommercePlatform;
use App\Enums\QueueName;
use App\Jobs\Middleware\WithTenantContext;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\OnlineOrders\OnlineOrderIngestionService;
use App\Services\WooCommerce\WooCommerceProductImportService;
use App\Services\WooCommerce\WooCommercePromotionSyncService;
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

    public function handle(
        OnlineOrderIngestionService $ingestionService,
        ?WooCommerceProductImportService $productImportService = null,
        ?WooCommercePromotionSyncService $promotionSyncService = null
    ): void {
        $user = User::withoutGlobalScopes()->find($this->userId);
        if (!$user) {
            Log::warning("ProcessWooCommerceWebhookJob: User #{$this->userId} not found.");
            return;
        }
        $normalized = strtolower(trim((string) ($this->topic ?? '')));
        if (str_starts_with($normalized, 'product.') || str_starts_with($normalized, 'coupon.')) {
            $this->handleCatalogOrCouponWebhook(
                $user,
                $normalized,
                $productImportService ?? app(WooCommerceProductImportService::class),
                $promotionSyncService ?? app(WooCommercePromotionSyncService::class)
            );
            return;
        }

        if (!empty($this->payload['id'])) {
            $ingestionService->ingest($user, EcommercePlatform::WOOCOMMERCE, $this->payload);
        }
    }

    private function handleCatalogOrCouponWebhook(
        User $user,
        string $normalizedTopic,
        WooCommerceProductImportService $productImportService,
        WooCommercePromotionSyncService $promotionSyncService
    ): void {
        $integration = WooCommerceIntegration::withoutGlobalScopes()
            ->where('user_id', $this->userId)
            ->where('is_active', true)
            ->first();

        if (!$integration) {
            return;
        }
        if (str_starts_with($normalizedTopic, 'product.')) {
            $productImportService->syncSingleProductFromWebhook($user, $integration, $this->payload);
            return;
        }

        $promotionSyncService->ingestCouponWebhook($user, $integration, $normalizedTopic, $this->payload);
    }
}
