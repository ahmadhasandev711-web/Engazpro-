<?php

namespace App\Jobs;

use App\Enums\QueueName;
use App\Jobs\Middleware\WithTenantContext;
use App\Models\Product;
use App\Models\ShopifyIntegration;
use App\Services\Shopify\ShopifyPricePushService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PushPriceToShopifyJob implements ShouldQueue, ShouldBeUniqueUntilProcessing
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
        $this->onQueue(QueueName::SHOPIFY_REALTIME->value);
    }

    public function middleware(): array
    {
        return [new WithTenantContext($this->userId)];
    }

    public function uniqueId(): string
    {
        return "{$this->userId}:shopify_price:{$this->productId}";
    }

    public function handle(ShopifyPricePushService $pricePushService): void
    {
        $integration = ShopifyIntegration::withoutGlobalScopes()
            ->where('user_id', $this->userId)
            ->where('is_active', true)
            ->where('auto_sync_prices', true)
            ->first();

        if (!$integration) {
            return;
        }

        $product = Product::withoutGlobalScopes()->where('user_id', $this->userId)->with('variants')->find($this->productId);
        if (!$product || empty($product->shopify_product_id)) {
            return;
        }

        $pricePushService->pushProduct($integration, $product);
    }
}
