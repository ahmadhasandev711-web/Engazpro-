<?php

namespace App\Services\WooCommerce;

use App\Models\Product;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use Illuminate\Support\Facades\Log;

class WooCommerceBulkStockPushService
{
    public function __construct(
        protected WooStockPushService $stockPushService
    ) {}

    /**
     * Push branch stock totals for all WooCommerce-linked products.
     *
     * @return array{synced_count: int, total_linked_products: int, errors: list<string>}
     */
    public function pushAll(User $user, WooCommerceIntegration $integration): array
    {
        if (empty($this->stockPushService->targetBranchIds($integration))) {
            return $this->emptyBranchesResult();
        }

        $accountId = $user->getAccountId();
        $products = Product::where('user_id', $accountId)->whereNotNull('wc_product_id')->with('variants')->get();

        $syncedCount = 0;
        $errors = [];
        foreach ($products as $product) {
            try {
                $this->stockPushService->pushProduct($integration, $product);
                $syncedCount++;
            } catch (\Throwable $e) {
                $errors[] = $this->logProductFailure($accountId, $product, $e);
            }
        }

        return [
            'synced_count' => $syncedCount,
            'total_linked_products' => $products->count(),
            'errors' => $errors,
        ];
    }

    /**
     * @return array{synced_count: int, total_linked_products: int, errors: list<string>}
     */
    private function emptyBranchesResult(): array
    {
        return [
            'synced_count' => 0,
            'total_linked_products' => 0,
            'errors' => ['لا توجد فروع أو مخازن نشطة محددة للمتجر الإلكتروني لسحب الرصيد منها.'],
        ];
    }

    private function logProductFailure(int $accountId, Product $product, \Throwable $e): string
    {
        Log::warning('WooCommerce bulk stock push failed for product', [
            'user_id' => $accountId,
            'product_id' => $product->id,
            'exception' => $e,
        ]);

        return "منتج #{$product->id} (WC {$product->wc_product_id}): " . $e->getMessage();
    }
}
