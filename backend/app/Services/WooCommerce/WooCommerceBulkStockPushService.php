<?php

namespace App\Services\WooCommerce;

use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class WooCommerceBulkStockPushService
{
    public function __construct(
        protected WooCommerceApiClient $apiClient
    ) {}

    /**
     * Push branch stock totals for all WooCommerce-linked products.
     *
     * @return array{synced_count: int, total_linked_products: int, errors: list<string>}
     */
    public function pushAll(User $user, WooCommerceIntegration $integration): array
    {
        $accountId = $user->getAccountId();
        $targetBranchIds = $this->resolveTargetBranchIds($accountId, $integration);

        $products = Product::where('user_id', $accountId)
            ->whereNotNull('wc_product_id')
            ->with('variants')
            ->get();

        if ($products->isEmpty()) {
            return [
                'synced_count' => 0,
                'total_linked_products' => 0,
                'errors' => [],
            ];
        }

        $syncedCount = 0;
        $errors = [];

        foreach ($products as $product) {
            try {
                $this->pushSingleProduct($integration, $product, $targetBranchIds);
                $syncedCount++;
            } catch (\Throwable $e) {
                $message = "منتج #{$product->id} (WC {$product->wc_product_id}): " . $e->getMessage();
                Log::warning('WooCommerce bulk stock push failed for product', [
                    'user_id' => $accountId,
                    'product_id' => $product->id,
                    'exception' => $e,
                ]);
                $errors[] = $message;
            }
        }

        return [
            'synced_count' => $syncedCount,
            'total_linked_products' => $products->count(),
            'errors' => $errors,
        ];
    }

    protected function resolveTargetBranchIds(int $accountId, WooCommerceIntegration $integration): Collection
    {
        if (!empty($integration->online_branch_id)) {
            return Branch::where('user_id', $accountId)
                ->where('id', $integration->online_branch_id)
                ->where('is_active', true)
                ->pluck('id');
        }

        return Branch::where('user_id', $accountId)
            ->whereIn('type', ['STORE', 'WAREHOUSE'])
            ->where('is_active', true)
            ->pluck('id');
    }

    protected function pushSingleProduct(
        WooCommerceIntegration $integration,
        Product $product,
        Collection $targetBranchIds
    ): void {
        if ($product->variants->isNotEmpty()) {
            foreach ($product->variants as $variant) {
                if (!$variant->wc_variation_id) {
                    continue;
                }

                $varStock = BranchStock::whereIn('branch_id', $targetBranchIds)
                    ->where('product_id', $product->id)
                    ->where('product_variant_id', $variant->id)
                    ->sum('quantity');

                $this->apiClient->updateVariationStock(
                    $integration,
                    (int) $product->wc_product_id,
                    (int) $variant->wc_variation_id,
                    max(0, (float) $varStock)
                );
            }
        }

        $totalStock = BranchStock::whereIn('branch_id', $targetBranchIds)
            ->where('product_id', $product->id)
            ->sum('quantity');

        $this->apiClient->updateProductStock(
            $integration,
            (int) $product->wc_product_id,
            max(0, (float) $totalStock)
        );
    }
}
