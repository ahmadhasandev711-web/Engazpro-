<?php

namespace App\Jobs;

use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WooCommerceApiClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PushStockToWooCommerceJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 25;
    public array $backoff = [10, 60];

    public function __construct(
        public int $userId,
        public int $productId,
        public ?int $productVariantId = null
    ) {}

    public function handle(WooCommerceApiClient $apiClient): void
    {
        $integration = WooCommerceIntegration::where('user_id', $this->userId)
            ->where('is_active', true)
            ->where('auto_sync_stock', true)
            ->first();

        if (!$integration) {
            return;
        }

        $product = Product::find($this->productId);
        if (!$product || !$product->wc_product_id) {
            return;
        }

        // Determine branches to sync: dedicated online branch, or all active store/warehouse branches
        if (!empty($integration->online_branch_id)) {
            $targetBranchIds = Branch::where('user_id', $this->userId)
                ->where('id', $integration->online_branch_id)
                ->where('is_active', true)
                ->pluck('id');
        } else {
            $targetBranchIds = Branch::where('user_id', $this->userId)
                ->whereIn('type', ['STORE', 'WAREHOUSE'])
                ->where('is_active', true)
                ->pluck('id');
        }

        if ($targetBranchIds->isEmpty()) {
            return;
        }

        if ($this->productVariantId) {
            $variant = ProductVariant::find($this->productVariantId);
            if (!$variant || !$variant->wc_variation_id) {
                return;
            }

            $totalStock = BranchStock::whereIn('branch_id', $targetBranchIds)
                ->where('product_id', $this->productId)
                ->where('product_variant_id', $this->productVariantId)
                ->sum('quantity');

            $apiClient->updateVariationStock(
                $integration,
                $product->wc_product_id,
                $variant->wc_variation_id,
                max(0, (float) $totalStock)
            );
        } else {
            $totalStock = BranchStock::whereIn('branch_id', $targetBranchIds)
                ->where('product_id', $this->productId)
                ->whereNull('product_variant_id')
                ->sum('quantity');

            $apiClient->updateProductStock(
                $integration,
                $product->wc_product_id,
                max(0, (float) $totalStock)
            );
        }
    }
}
