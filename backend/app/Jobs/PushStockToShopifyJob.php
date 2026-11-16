<?php

namespace App\Jobs;

use App\Enums\QueueName;
use App\Models\Product;
use App\Models\ShopifyIntegration;
use App\Services\Shopify\ShopifyStockPushService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PushStockToShopifyJob implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 25;
    public array $backoff = [10, 60];
    public int $uniqueFor = 60;

    public function __construct(
        public int $userId,
        public int $productId,
        public ?int $productVariantId = null,
        public ?int $branchId = null
    ) {
        $this->onQueue(QueueName::SHOPIFY_REALTIME->value);
    }

    public function uniqueId(): string
    {
        return "{$this->userId}:{$this->productId}:" . ($this->productVariantId ?? 'null') . ':' . ($this->branchId ?? 'all');
    }

    public function handle(ShopifyStockPushService $stockPushService): void
    {
        $integration = ShopifyIntegration::withoutGlobalScopes()
            ->where('user_id', $this->userId)
            ->where('is_active', true)
            ->where('auto_sync_stock', true)
            ->first();

        if (!$integration) {
            return;
        }

        $product = Product::withoutGlobalScopes()->where('user_id', $this->userId)->find($this->productId);
        if (!$product || empty($product->shopify_product_id)) {
            return;
        }

        $stockPushService->pushProduct($integration, $product, $this->branchId, $this->productVariantId);
    }
}
