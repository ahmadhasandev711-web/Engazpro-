<?php

namespace App\Services\WooCommerce;

use App\Contracts\WooCommerceApiClientInterface;
use App\Enums\ProductType;
use App\Enums\StockMovementSource;
use App\Enums\StockMovementType;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\ProductService;
use App\Services\StockService;
use App\Support\Money;
use App\Support\Quantity;
use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WooCommerceProductImportService
{
    public function __construct(
        protected WooCommerceApiClientInterface $apiClient,
        protected ProductService $productService,
        protected StockService $stockService
    ) {}

    /**
     * Import a single page of products from WooCommerce.
     *
     * @return array{imported: int, updated: int, errors: list<string>, count: int, has_more: bool}
     */
    public function importPage(User $user, WooCommerceIntegration $integration, int $page = 1, int $perPage = 50, bool $importStock = false): array
    {
        return WooStockSyncGate::suppressDuring($user->getAccountId(), function () use ($user, $integration, $page, $perPage, $importStock) {
            $imported = 0;
            $updated = 0;
            $errors = [];
            $wcProducts = $this->apiClient->getProducts($integration, $page, $perPage);

            foreach ($wcProducts as $wcProduct) {
                $result = $this->syncPageItemSafely($user, $integration, $wcProduct, $importStock, $errors);
                $result === 'created' ? $imported++ : ($result === 'updated' ? $updated++ : null);
            }

            $integration->update(['last_synced_at' => now(), 'last_error' => !empty($errors) ? implode("\n", array_slice($errors, 0, 5)) : null]);
            $count = count($wcProducts);

            return ['imported' => $imported, 'updated' => $updated, 'errors' => $errors, 'count' => $count, 'has_more' => $count === $perPage];
        });
    }

    private function syncPageItemSafely(User $user, WooCommerceIntegration $integration, array $wcProduct, bool $importStock, array &$errors): ?string
    {
        try {
            return $this->syncSingleProduct($user, $integration, $wcProduct, $importStock);
        } catch (Exception $e) {
            Log::error("Failed to import WC Product #{$wcProduct['id']}: " . $e->getMessage());
            $errors[] = "منتج #{$wcProduct['id']} ({$wcProduct['name']}): " . $e->getMessage();
            return null;
        }
    }

    /**
     * Import or update products from WooCommerce to Kashat.
     * Initial stock is strictly 0 because Kashat multi-warehouse controls inventory.
     */
    public function importProducts(User $user, WooCommerceIntegration $integration, bool $importStock = false): array
    {
        $imported = 0;
        $updated = 0;
        $errors = [];
        $page = 1;
        $perPage = 50;

        do {
            $pageResult = $this->importPage($user, $integration, $page, $perPage, $importStock);
            $imported += $pageResult['imported'];
            $updated += $pageResult['updated'];
            $errors = array_merge($errors, $pageResult['errors']);
            $page++;
        } while ($pageResult['has_more']);

        return [
            'imported' => $imported,
            'updated' => $updated,
            'errors' => $errors,
        ];
    }

    /**
     * Synchronize a single product from WooCommerce data
     */
    protected function syncSingleProduct(User $user, WooCommerceIntegration $integration, array $wcProduct, bool $importStock = false): string
    {
        $name = trim($wcProduct['name'] ?? '');
        if (empty($name) || str_starts_with($name, 'Import placeholder for')) {
            return 'skipped';
        }

        $accountId = $user->getAccountId();
        $meta = $this->extractWcProductMetadata($accountId, $wcProduct, $name);
        $product = $this->findExistingWcProduct($accountId, $meta['wc_id'], $meta['sku']);

        if ($product) {
            $this->updateExistingWcProduct($user, $integration, $product, $wcProduct, $meta, $importStock);
            return 'updated';
        }

        $this->createNewWcProduct($user, $integration, $wcProduct, $meta, $importStock);
        return 'created';
    }

    private function extractWcProductMetadata(int $accountId, array $wcProduct, string $name): array
    {
        $categoryId = null;
        if (!empty($wcProduct['categories']) && is_array($wcProduct['categories'])) {
            $firstCat = html_entity_decode(trim($wcProduct['categories'][0]['name'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if (!empty($firstCat)) {
                $categoryId = \App\Models\Category::firstOrCreate(['user_id' => $accountId, 'name' => $firstCat])->id;
            }
        }

        return [
            'wc_id' => (int) $wcProduct['id'],
            'sku' => !empty($wcProduct['sku']) ? trim($wcProduct['sku']) : null,
            'name' => $name,
            'regular_price' => isset($wcProduct['regular_price']) && is_numeric($wcProduct['regular_price']) ? Money::of($wcProduct['regular_price'])->getAmount() : null,
            'sale_price' => $this->resolveSellingPrice($wcProduct, 0),
            'is_variable' => ($wcProduct['type'] ?? '') === 'variable',
            'image_url' => !empty($wcProduct['images'][0]['src']) ? (string) $wcProduct['images'][0]['src'] : null,
            'category_id' => $categoryId,
        ];
    }

    private function findExistingWcProduct(int $accountId, int $wcId, ?string $sku): ?Product
    {
        return Product::where('user_id', $accountId)->where(function ($query) use ($wcId, $sku) {
            $query->where('wc_product_id', $wcId);
            if ($sku) {
                $query->orWhere('barcode', $sku)->orWhere('code', $sku);
            }
        })->first();
    }

    private function updateExistingWcProduct(User $user, WooCommerceIntegration $integration, Product $product, array $wcProduct, array $meta, bool $importStock): void
    {
        $updateData = array_filter([
            'name' => $meta['name'],
            'wc_product_id' => $meta['wc_id'],
            'regular_price' => $meta['regular_price'],
            'sale_price' => $meta['sale_price'] > 0 ? $meta['sale_price'] : null,
            'barcode' => ($meta['sku'] && empty($product->barcode)) ? $meta['sku'] : null,
            'category_id' => $meta['category_id'],
            'image_url' => $meta['image_url'],
        ], fn ($v) => $v !== null);

        $product->update($updateData);
        $targetBranchId = $this->resolveTargetBranchId($user, $integration);

        if (!$meta['is_variable'] && $this->isTargetBranchStockZero($product, null, $targetBranchId)) {
            $qty = $this->extractWcStockQty($wcProduct, $importStock);
            $this->recordWcInitialStock($user, $targetBranchId, $product, $qty, Money::of($product->purchase_price ?? 0)->getAmount(), 'رصيد أول المدة مستورد من ووكومرس');
        }
        if ($meta['is_variable']) {
            $this->syncVariations($user, $integration, $product, $meta['wc_id'], $importStock);
        }
    }

    private function createNewWcProduct(User $user, WooCommerceIntegration $integration, array $wcProduct, array $meta, bool $importStock): void
    {
        $initialQty = $meta['is_variable'] ? 0 : $this->extractWcStockQty($wcProduct, $importStock);
        $productData = [
            'name' => $meta['name'], 'category_id' => $meta['category_id'], 'code' => $meta['sku'], 'barcode' => $meta['sku'],
            'purchase_price' => 0, 'regular_price' => $meta['regular_price'], 'sale_price' => $meta['sale_price'],
            'quantity' => $initialQty, 'min_quantity' => 5, 'unit' => 'قطعة',
            'wc_product_id' => $meta['wc_id'], 'image_url' => $meta['image_url'],
            'type' => $meta['is_variable'] ? ProductType::VARIABLE->value : ProductType::STANDARD->value,
        ];

        if ($meta['is_variable']) {
            $productData['variants'] = $this->buildWcVariantsPayload($integration, $meta['wc_id'], $meta['sale_price'], $meta['image_url'], $importStock);
        }

        $this->productService->createProduct($user, $productData, $this->resolveTargetBranchId($user, $integration));
    }

    private function buildWcVariantsPayload(WooCommerceIntegration $integration, int $wcId, float $fallbackPrice, ?string $defaultImageUrl, bool $importStock): array
    {
        $variantsPayload = [];
        foreach ($this->apiClient->getProductVariations($integration, $wcId) as $var) {
            $varData = $this->extractWcVariationMetadata($var, $fallbackPrice, $defaultImageUrl);
            $variantsPayload[] = [
                'name' => $varData['attributes']['name'] ?: "متغير #{$varData['id']}",
                'size' => $varData['attributes']['size'], 'color' => $varData['attributes']['color'],
                'barcode' => $varData['sku'], 'code' => $varData['sku'], 'purchase_price' => 0,
                'regular_price' => $varData['regular_price'], 'sale_price' => $varData['sale_price'],
                'quantity' => $this->extractWcStockQty($var, $importStock), 'min_quantity' => 2,
                'wc_variation_id' => $varData['id'], 'image_url' => $varData['image_url'],
            ];
        }

        return $variantsPayload;
    }

    private function extractWcStockQty(array $wcItem, bool $importStock): float
    {
        if ($importStock && !empty($wcItem['manage_stock']) && isset($wcItem['stock_quantity']) && Quantity::of($wcItem['stock_quantity'])->isPositive()) {
            return Quantity::of($wcItem['stock_quantity'])->toFloat();
        }

        return 0;
    }

    private function extractWcVariationMetadata(array $var, float $fallbackPrice, ?string $defaultImageUrl): array
    {
        return [
            'id' => (int) $var['id'],
            'sku' => !empty($var['sku']) ? trim($var['sku']) : null,
            'regular_price' => isset($var['regular_price']) && is_numeric($var['regular_price']) ? Money::of($var['regular_price'])->getAmount() : null,
            'sale_price' => $this->resolveSellingPrice($var, $fallbackPrice),
            'attributes' => $this->extractAttributes($var['attributes'] ?? []),
            'image_url' => !empty($var['image']['src']) ? (string) $var['image']['src'] : $defaultImageUrl,
        ];
    }

    private function recordWcInitialStock(User $user, ?int $branchId, Product $product, float $qty, float $purchasePrice, string $note, $variant = null): void
    {
        if ($qty <= 0) {
            return;
        }
        $this->stockService->recordMovement(
            $user, $product, StockMovementType::IN->value, StockMovementSource::INITIAL->value,
            $product->id, $qty, $purchasePrice, $note, variant: $variant, branchId: $branchId
        );
    }

    private function resolveTargetBranchId(User $user, WooCommerceIntegration $integration): ?int
    {
        $accountId = $user->getAccountId();
        if (!empty($integration->online_branch_id)) {
            return (int) $integration->online_branch_id;
        }

        return Branch::where('user_id', $accountId)->where('is_main', true)->where('is_active', true)->value('id')
            ?? Branch::where('user_id', $accountId)->where('is_active', true)->value('id');
    }

    private function isTargetBranchStockZero(Product $product, ?ProductVariant $variant, ?int $branchId): bool
    {
        if (!$branchId) {
            return Quantity::of($variant?->quantity ?? $product->quantity ?? 0)->isZero();
        }
        $branchQty = BranchStock::withoutGlobalScopes()
            ->where('branch_id', $branchId)->where('product_id', $product->id)
            ->when($variant, fn ($q) => $q->where('product_variant_id', $variant->id), fn ($q) => $q->whereNull('product_variant_id'))
            ->value('quantity');

        return $branchQty === null || Quantity::of($branchQty)->isZero();
    }

    /**
     * Synchronize variations for an existing variable product
     */
    protected function syncVariations(User $user, WooCommerceIntegration $integration, Product $product, int $wcId, bool $importStock = false): void
    {
        $fallbackPrice = Money::of($product->sale_price)->getAmount();
        foreach ($this->apiClient->getProductVariations($integration, $wcId) as $var) {
            $varData = $this->extractWcVariationMetadata($var, $fallbackPrice, $product->image_url);
            $this->syncSingleVariation($user, $integration, $product, $var, $varData, $importStock);
        }
    }

    private function syncSingleVariation(User $user, WooCommerceIntegration $integration, Product $product, array $var, array $varData, bool $importStock): void
    {
        $variant = $product->variants()->where(function ($query) use ($varData) {
            $query->where('wc_variation_id', $varData['id']);
            if ($varData['sku']) {
                $query->orWhere('barcode', $varData['sku'])->orWhere('code', $varData['sku']);
            }
        })->first();

        if ($variant) {
            $this->updateExistingWcVariant($user, $integration, $product, $variant, $var, $varData, $importStock);
        } else {
            $this->createNewWcVariant($user, $integration, $product, $var, $varData, $importStock);
        }
    }

    private function updateExistingWcVariant(User $user, WooCommerceIntegration $integration, Product $product, $variant, array $var, array $varData, bool $importStock): void
    {
        $update = array_filter([
            'wc_variation_id' => $varData['id'],
            'name' => $varData['attributes']['name'] ?: $variant->name,
            'size' => $varData['attributes']['size'] ?: $variant->size,
            'color' => $varData['attributes']['color'] ?: $variant->color,
            'sale_price' => $varData['sale_price'] > 0 ? $varData['sale_price'] : $variant->sale_price,
            'barcode' => $varData['sku'] ?: $variant->barcode,
            'regular_price' => $varData['regular_price'],
            'image_url' => $varData['image_url'],
        ], fn ($v) => $v !== null);

        $variant->update($update);
        $targetBranchId = $this->resolveTargetBranchId($user, $integration);
        if ($this->isTargetBranchStockZero($product, $variant, $targetBranchId)) {
            $this->recordWcInitialStock($user, $targetBranchId, $product, $this->extractWcStockQty($var, $importStock), Money::of($variant->purchase_price ?? 0)->getAmount(), 'رصيد أول المدة للمتغير مستورد من ووكومرس', $variant);
        }
    }

    private function createNewWcVariant(User $user, WooCommerceIntegration $integration, Product $product, array $var, array $varData, bool $importStock): void
    {
        $newVar = $product->variants()->create([
            'user_id' => $user->getAccountId(), 'wc_variation_id' => $varData['id'],
            'name' => $varData['attributes']['name'] ?: "متغير #{$varData['id']}",
            'size' => $varData['attributes']['size'], 'color' => $varData['attributes']['color'],
            'barcode' => $varData['sku'], 'code' => $varData['sku'], 'purchase_price' => 0,
            'regular_price' => $varData['regular_price'], 'sale_price' => $varData['sale_price'],
            'quantity' => 0, 'min_quantity' => 2, 'image_url' => $varData['image_url'],
        ]);
        $this->recordWcInitialStock($user, $this->resolveTargetBranchId($user, $integration), $product, $this->extractWcStockQty($var, $importStock), Money::of($newVar->purchase_price ?? 0)->getAmount(), 'رصيد أول المدة للمتغير مستورد من ووكومرس', $newVar);
    }

    /**
     * Resolve active selling price from WooCommerce item (promotional sale_price / active price, falling back to regular_price)
     */
    protected function resolveSellingPrice(array $wcItem, ?float $fallback = 0): float
    {
        if (isset($wcItem['price']) && is_numeric($wcItem['price']) && Money::of($wcItem['price'])->isPositive()) {
            return Money::of($wcItem['price'])->getAmount();
        }
        if (isset($wcItem['sale_price']) && is_numeric($wcItem['sale_price']) && Money::of($wcItem['sale_price'])->isPositive()) {
            return Money::of($wcItem['sale_price'])->getAmount();
        }
        if (isset($wcItem['regular_price']) && is_numeric($wcItem['regular_price']) && Money::of($wcItem['regular_price'])->isPositive()) {
            return Money::of($wcItem['regular_price'])->getAmount();
        }
        return Money::of($fallback ?? 0)->getAmount();
    }

    /**
     * Parse color, size and display name from WooCommerce attributes array
     */
    protected function extractAttributes(array $attributes): array
    {
        $color = null;
        $size = null;
        $parts = [];

        foreach ($attributes as $attr) {
            $name = strtolower($attr['name'] ?? '');
            $option = $attr['option'] ?? '';

            if (str_contains($name, 'color') || str_contains($name, 'لون')) {
                $color = $option;
                $parts[] = "لون: {$option}";
            } elseif (str_contains($name, 'size') || str_contains($name, 'مقاس')) {
                $size = $option;
                $parts[] = "مقاس: {$option}";
            } else {
                $parts[] = "{$attr['name']}: {$option}";
            }
        }

        return [
            'color' => $color,
            'size' => $size,
            'name' => implode(' | ', $parts),
        ];
    }
}
