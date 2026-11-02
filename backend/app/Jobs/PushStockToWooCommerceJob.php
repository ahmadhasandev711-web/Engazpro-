<?php

namespace App\Jobs;

use App\Contracts\WooCommerceApiClientInterface;
use App\Enums\QueueName;
use App\Exceptions\WooCommerceConnectionException;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\StockReservationService;
use App\Support\Quantity;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

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

    public function handle(WooCommerceApiClientInterface $apiClient, StockReservationService $reservationService): void
    {
        $integration = WooCommerceIntegration::where('user_id', $this->userId)
            ->where('is_active', true)
            ->where('auto_sync_stock', true)
            ->first();

        if (!$integration) {
            return;
        }

        $product = Product::withoutGlobalScopes()->where('user_id', $this->userId)->find($this->productId);
        if (!$product || !$product->wc_product_id) {
            return;
        }

        $targetBranchIds = $this->resolveTargetBranchIds($integration);
        if ($targetBranchIds->isEmpty()) {
            return;
        }

        $branchIds = $targetBranchIds->all();
        $reserved = $reservationService->reservedQuantity($this->userId, $this->productId, $this->productVariantId, $branchIds);

        $this->syncStockToWooCommerce($apiClient, $integration, $product, $branchIds, $reserved);
    }

    /**
     * @return Collection<int, int>
     */
    private function resolveTargetBranchIds(WooCommerceIntegration $integration): Collection
    {
        if (!empty($integration->online_branch_id)) {
            return Branch::withoutGlobalScopes()
                ->where('user_id', $this->userId)
                ->where('id', $integration->online_branch_id)
                ->where('is_active', true)
                ->pluck('id');
        }

        return Branch::withoutGlobalScopes()
            ->where('user_id', $this->userId)
            ->whereIn('type', ['STORE', 'WAREHOUSE'])
            ->where('is_active', true)
            ->pluck('id');
    }

    /**
     * @param array<int, int> $targetBranchIds
     */
    private function syncStockToWooCommerce(
        WooCommerceApiClientInterface $apiClient,
        WooCommerceIntegration $integration,
        Product $product,
        array $targetBranchIds,
        Quantity $reserved
    ): void {
        if ($this->productVariantId) {
            $variant = ProductVariant::withoutGlobalScopes()->find($this->productVariantId);
            if (!$variant || !$variant->wc_variation_id) {
                return;
            }

            $totalStock = BranchStock::whereIn('branch_id', $targetBranchIds)
                ->where('product_id', $this->productId)
                ->where('product_variant_id', $this->productVariantId)
                ->sum('quantity');

            $available = Quantity::of($totalStock ?? 0)->subtract($reserved)->maxZero()->toFloat();

            $success = $apiClient->updateVariationStock(
                $integration,
                $product->wc_product_id,
                $variant->wc_variation_id,
                $available
            );

            if (!$success) {
                throw new WooCommerceConnectionException(
                    "Failed to update variation stock in WooCommerce for variant {$this->productVariantId}."
                );
            }
        } else {
            $totalStock = BranchStock::whereIn('branch_id', $targetBranchIds)
                ->where('product_id', $this->productId)
                ->whereNull('product_variant_id')
                ->sum('quantity');

            $available = Quantity::of($totalStock ?? 0)->subtract($reserved)->maxZero()->toFloat();

            $success = $apiClient->updateProductStock(
                $integration,
                $product->wc_product_id,
                $available
            );

            if (!$success) {
                throw new WooCommerceConnectionException(
                    "Failed to update product stock in WooCommerce for product {$this->productId}."
                );
            }
        }
    }
}
