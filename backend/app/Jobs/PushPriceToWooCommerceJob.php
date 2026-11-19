<?php

namespace App\Jobs;

use App\Enums\QueueName;
use App\Jobs\Middleware\WithTenantContext;
use App\Models\Product;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WooCommercePricePushService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PushPriceToWooCommerceJob implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 30;
    public array $backoff = [10, 60];
    public int $uniqueFor = 60;

    public function __construct(
        public int $userId,
        public int $productId
    ) {
        $this->onQueue(QueueName::WOO_REALTIME->value);
    }

    public function middleware(): array
    {
        return [new WithTenantContext($this->userId)];
    }

    public function uniqueId(): string
    {
        return "{$this->userId}:price:{$this->productId}";
    }

    public function handle(WooCommercePricePushService $pricePushService): void
    {
        $integration = WooCommerceIntegration::withoutGlobalScopes()
            ->where('user_id', $this->userId)
            ->where('is_active', true)
            ->where('auto_sync_prices', true)
            ->first();

        if (!$integration || empty($integration->consumer_key) || empty($integration->consumer_secret)) {
            return;
        }

        $product = Product::withoutGlobalScopes()->where('user_id', $this->userId)->with('variants')->find($this->productId);
        if (!$product || empty($product->wc_product_id)) {
            return;
        }

        $pricePushService->pushProduct($integration, $product);
    }
}
