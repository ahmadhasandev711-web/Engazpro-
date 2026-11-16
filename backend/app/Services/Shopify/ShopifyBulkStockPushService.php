<?php

namespace App\Services\Shopify;

use App\Models\Product;
use App\Models\ShopifyIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class ShopifyBulkStockPushService
{
    public function __construct(
        protected ShopifyStockPushService $stockPushService
    ) {}

    /**
     * @return array{synced_count: int, total_linked_products: int, errors: list<string>}
     */
    public function pushAll(User $user, ShopifyIntegration $integration): array
    {
        if ($this->stockPushService->activeMappings($integration)->isEmpty()) {
            return ['synced_count' => 0, 'total_linked_products' => 0, 'errors' => ['لا توجد مواقع Shopify مربوطة بفروع نشطة لمزامنة المخزون إليها.']];
        }

        $accountId = $user->getAccountId();
        $products = Product::where('user_id', $accountId)->whereNotNull('shopify_product_id')->with('variants')->get();
        $synced = 0;
        $errors = [];

        foreach ($products as $product) {
            try {
                $this->stockPushService->pushProduct($integration, $product);
                $synced++;
            } catch (\Throwable $e) {
                Log::warning('Shopify bulk stock push failed', ['user_id' => $accountId, 'product_id' => $product->id, 'exception' => $e]);
                $errors[] = "منتج #{$product->id}: " . $e->getMessage();
            }
        }

        return ['synced_count' => $synced, 'total_linked_products' => $products->count(), 'errors' => $errors];
    }
}
