<?php

namespace App\Jobs;

use App\Enums\QueueName;
use App\Exceptions\EasyOrdersConnectionException;
use App\Jobs\Middleware\WithTenantContext;
use App\Models\EasyOrdersIntegration;
use App\Models\Product;
use App\Services\EasyOrders\EasyOrdersStockPushService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PushStockToEasyOrdersJob implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 4;
    public int $timeout = 25;
    public array $backoff = [15, 60, 120];
    public int $uniqueFor = 60;

    public function __construct(
        public int $userId,
        public int $productId,
        public ?int $productVariantId = null
    ) {
        $this->onQueue(QueueName::EASYORDERS_REALTIME->value);
    }

    public function middleware(): array
    {
        return [new WithTenantContext($this->userId)];
    }

    public function uniqueId(): string
    {
        return "eo_stock:{$this->userId}:{$this->productId}:" . ($this->productVariantId ?? 'all');
    }

    public function handle(EasyOrdersStockPushService $pushService): void
    {
        $integration = EasyOrdersIntegration::withoutGlobalScopes()
            ->where('user_id', $this->userId)
            ->where('is_active', true)
            ->where('auto_sync_stock', true)
            ->first();

        $product = $integration ? Product::withoutGlobalScopes()->where('user_id', $this->userId)->with('variants')->find($this->productId) : null;
        if (!$integration || !$product) {
            return;
        }

        try {
            $pushService->pushProduct($integration, $product, $this->productVariantId);
        } catch (EasyOrdersConnectionException $e) {
            if ($e->isRateLimited() && $this->attempts() < $this->tries) {
                $this->release($e->retryAfterSeconds > 0 ? $e->retryAfterSeconds : 60);
                return;
            }
            $integration->update(['last_error' => $e->getMessage()]);
        }
    }
}
