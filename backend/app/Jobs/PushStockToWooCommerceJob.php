<?php

namespace App\Jobs;

use App\Enums\QueueName;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WooStockPushService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PushStockToWooCommerceJob implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 25;
    public array $backoff = [10, 60];
    public int $uniqueFor = 60;

    public function __construct(
        public int $userId,
        public int $productId,
        public ?int $productVariantId = null
    ) {
        $this->onQueue(QueueName::WOO_REALTIME->value);
    }

    public function uniqueId(): string
    {
        return "{$this->userId}:{$this->productId}:" . ($this->productVariantId ?? 'null');
    }

    public function handle(WooStockPushService $stockPushService): void
    {
        $integration = WooCommerceIntegration::where('user_id', $this->userId)
            ->where('is_active', true)
            ->where('auto_sync_stock', true)
            ->first();

        if (!$integration || empty($integration->consumer_key) || empty($integration->consumer_secret)) {
            return;
        }

        $product = Product::withoutGlobalScopes()->where('user_id', $this->userId)->find($this->productId);
        if (!$product || empty($product->wc_product_id)) {
            return;
        }

        if ($this->productVariantId !== null) {
            $variant = ProductVariant::withoutGlobalScopes()->find($this->productVariantId);
            if (!$variant || empty($variant->wc_variation_id)) {
                return;
            }

            $stockPushService->push($integration, $product, $variant);
            return;
        }

        $stockPushService->push($integration, $product);
    }
}
