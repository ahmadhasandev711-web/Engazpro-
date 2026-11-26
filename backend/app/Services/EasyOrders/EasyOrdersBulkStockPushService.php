<?php

namespace App\Services\EasyOrders;

use App\Models\EasyOrdersIntegration;
use App\Models\Product;

class EasyOrdersBulkStockPushService
{
    public function __construct(
        protected EasyOrdersStockPushService $stockPushService
    ) {}

    /**
     * @return array{synced_count: int, failed_count: int, errors: list<string>}
     */
    public function pushAllLinked(EasyOrdersIntegration $integration): array
    {
        $synced = 0;
        $failed = 0;
        $errors = [];

        Product::where('user_id', $integration->user_id)
            ->whereNotNull('easyorders_product_id')
            ->with('variants')
            ->chunkById(50, function ($products) use ($integration, &$synced, &$failed, &$errors) {
                $this->processChunk($integration, $products, $synced, $failed, $errors);
            });

        $integration->update([
            'last_synced_at' => now(),
            'last_error' => $errors[0] ?? null,
        ]);

        return ['synced_count' => $synced, 'failed_count' => $failed, 'errors' => $errors];
    }

    private function processChunk(EasyOrdersIntegration $integration, iterable $products, int &$synced, int &$failed, array &$errors): void
    {
        foreach ($products as $product) {
            try {
                if ($this->stockPushService->pushProduct($integration, $product) > 0) {
                    $synced++;
                }
            } catch (\Throwable $e) {
                $failed++;
                $errors[] = "{$product->name}: {$e->getMessage()}";
            }
        }
    }
}
