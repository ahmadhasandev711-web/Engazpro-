<?php

namespace App\Services\WooCommerce;

use App\Contracts\WooCommerceApiClientInterface;
use App\Enums\BranchType;
use App\Exceptions\NoActiveStockBranchesException;
use App\Exceptions\PosDomainException;
use App\Exceptions\WooCommerceConnectionException;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\WooCommerceIntegration;
use App\Support\Quantity;
use Illuminate\Support\Collection;

class WooStockPushService
{
    public function __construct(
        protected WooCommerceApiClientInterface $apiClient,
        protected StockReservationService $reservationService
    ) {}

    /**
     * @return list<int>
     */
    public function targetBranchIds(WooCommerceIntegration $integration): array
    {
        if (!empty($integration->online_branch_id)) {
            return Branch::withoutGlobalScopes()
                ->where('user_id', $integration->user_id)
                ->where('id', $integration->online_branch_id)
                ->where('is_active', true)
                ->pluck('id')
                ->all();
        }

        return Branch::withoutGlobalScopes()
            ->where('user_id', $integration->user_id)
            ->whereIn('type', [BranchType::STORE->value, BranchType::WAREHOUSE->value])
            ->where('is_active', true)
            ->pluck('id')
            ->all();
    }

    /**
     * @param list<int> $branchIds
     */
    public function availableQuantity(int $accountId, int $productId, ?int $variantId, array $branchIds): Quantity
    {
        if (empty($branchIds)) {
            return Quantity::zero();
        }

        $query = BranchStock::withoutGlobalScopes()
            ->whereIn('branch_id', $branchIds)
            ->where('product_id', $productId);

        $variantId !== null
            ? $query->where('product_variant_id', $variantId)
            : $query->whereNull('product_variant_id');

        $raw = $query->sum('quantity') ?? 0;
        $reserved = $this->reservationService->reservedQuantity($accountId, $productId, $variantId, $branchIds);

        return Quantity::of($raw)->subtract($reserved)->maxZero();
    }

    public function push(WooCommerceIntegration $integration, Product $product, ?ProductVariant $variant = null): Quantity
    {
        $branchIds = $this->targetBranchIds($integration);
        if (empty($branchIds)) {
            throw new NoActiveStockBranchesException();
        }

        $available = $this->availableQuantity($integration->user_id, $product->id, $variant?->id, $branchIds);

        $success = $variant !== null
            ? $this->pushVariantStock($integration, $product, $variant, $available)
            : $this->pushSimpleStock($integration, $product, $available);

        if (!$success) {
            $desc = $variant ? "variant {$variant->id}" : "product {$product->id}";
            throw new WooCommerceConnectionException("Failed to update stock in WooCommerce for {$desc}.");
        }

        return $available;
    }

    private function pushVariantStock(WooCommerceIntegration $integration, Product $product, ProductVariant $variant, Quantity $qty): bool
    {
        if (empty($variant->wc_variation_id)) {
            return true;
        }

        return $this->apiClient->updateVariationStock(
            $integration,
            (int) $product->wc_product_id,
            (int) $variant->wc_variation_id,
            $qty->toFloat()
        );
    }

    private function pushSimpleStock(WooCommerceIntegration $integration, Product $product, Quantity $qty): bool
    {
        if (empty($product->wc_product_id)) {
            return true;
        }

        return $this->apiClient->updateProductStock(
            $integration,
            (int) $product->wc_product_id,
            $qty->toFloat()
        );
    }

    /**
     * @return array{product_id: int, wc_product_id: int|null, synced_variants: int, total_stock: Quantity, message: string}
     */
    public function pushProduct(WooCommerceIntegration $integration, Product $product): array
    {
        $branchIds = $this->targetBranchIds($integration);
        if (empty($branchIds)) {
            throw new NoActiveStockBranchesException();
        }

        $variants = $product->relationLoaded('variants') ? $product->variants : $product->variants()->get();
        $linkedVariants = $variants->filter(fn($v) => !empty($v->wc_variation_id));

        if ($linkedVariants->isNotEmpty()) {
            return $this->pushVariableProduct($integration, $product, $linkedVariants);
        }

        return $this->pushSimpleProduct($integration, $product);
    }

    /**
     * @param Collection<int, ProductVariant> $variants
     * @return array{product_id: int, wc_product_id: int|null, synced_variants: int, total_stock: Quantity, message: string}
     */
    private function pushVariableProduct(WooCommerceIntegration $integration, Product $product, Collection $variants): array
    {
        $totalStock = Quantity::zero();
        foreach ($variants as $variant) {
            $pushed = $this->push($integration, $product, $variant);
            $totalStock = $totalStock->add($pushed);
        }

        return [
            'product_id' => $product->id,
            'wc_product_id' => $product->wc_product_id,
            'synced_variants' => $variants->count(),
            'total_stock' => $totalStock,
            'message' => "تم تحديث رصيد الصنف ({$product->name}) ومتبقياته ({$variants->count()} متغير) في ووكومرس فورياً بإجمالي {$totalStock->toDecimalString()} قطعة بنجاح 🟢",
        ];
    }

    /**
     * @return array{product_id: int, wc_product_id: int|null, synced_variants: int, total_stock: Quantity, message: string}
     */
    private function pushSimpleProduct(WooCommerceIntegration $integration, Product $product): array
    {
        $pushed = $this->push($integration, $product, null);

        return [
            'product_id' => $product->id,
            'wc_product_id' => $product->wc_product_id,
            'synced_variants' => 0,
            'total_stock' => $pushed,
            'message' => "تم تحديث رصيد الصنف ({$product->name}) في ووكومرس فورياً إلى {$pushed->toDecimalString()} قطعة بنجاح 🟢",
        ];
    }

    /**
     * @return array{product_id: int, wc_product_id: int|null, synced_variants: int, total_stock: Quantity, message: string}
     */
    public function pushProductForAccount(int $accountId, Product $product): array
    {
        $integration = WooCommerceIntegration::where('user_id', $accountId)
            ->where('is_active', true)
            ->first();

        if (!$integration || empty($integration->consumer_key) || empty($integration->consumer_secret)) {
            throw new PosDomainException('ربط متجر ووكومرس غير نشط أو غير مهيأ بعد بالمفاتيح.');
        }

        if (empty($product->wc_product_id)) {
            throw new PosDomainException("الصنف '{$product->name}' غير مرتبط بمنتج في متجر ووكومرس (ليس لديه معرف ووكومرس).");
        }

        return $this->pushProduct($integration, $product);
    }
}
