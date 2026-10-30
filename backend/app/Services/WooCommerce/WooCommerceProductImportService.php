<?php

namespace App\Services\WooCommerce;

use App\Contracts\WooCommerceApiClientInterface;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\ProductService;
use App\Services\StockService;
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
        $imported = 0;
        $updated = 0;
        $errors = [];

        $wcProducts = $this->apiClient->getProducts($integration, $page, $perPage);

        if (!empty($wcProducts)) {
            foreach ($wcProducts as $wcProduct) {
                try {
                    $result = $this->syncSingleProduct($user, $integration, $wcProduct, $importStock);
                    if ($result === 'created') {
                        $imported++;
                    } elseif ($result === 'updated') {
                        $updated++;
                    }
                } catch (Exception $e) {
                    Log::error("Failed to import WC Product #{$wcProduct['id']}: " . $e->getMessage());
                    $errors[] = "منتج #{$wcProduct['id']} ({$wcProduct['name']}): " . $e->getMessage();
                }
            }
        }

        $integration->update([
            'last_synced_at' => now(),
            'last_error' => !empty($errors) ? implode("\n", array_slice($errors, 0, 5)) : null,
        ]);

        $count = count($wcProducts);

        return [
            'imported' => $imported,
            'updated' => $updated,
            'errors' => $errors,
            'count' => $count,
            'has_more' => $count === $perPage,
        ];
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
        $accountId = $user->getAccountId();
        $wcId = (int) $wcProduct['id'];
        $sku = !empty($wcProduct['sku']) ? trim($wcProduct['sku']) : null;
        $name = trim($wcProduct['name'] ?? '');

        // Skip WooCommerce temporary import placeholders or empty names
        if (empty($name) || str_starts_with($name, 'Import placeholder for')) {
            return 'skipped';
        }

        $regularPrice = isset($wcProduct['regular_price']) && is_numeric($wcProduct['regular_price']) ? (float) $wcProduct['regular_price'] : null;
        $salePrice = $this->resolveSellingPrice($wcProduct, 0);
        $isVariable = ($wcProduct['type'] ?? '') === 'variable';
        $imageUrl = !empty($wcProduct['images'][0]['src']) ? (string) $wcProduct['images'][0]['src'] : null;

        // Resolve category from WooCommerce
        $categoryId = null;
        if (!empty($wcProduct['categories']) && is_array($wcProduct['categories'])) {
            $rawCat = $wcProduct['categories'][0]['name'] ?? '';
            $firstCat = html_entity_decode(trim($rawCat), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if (!empty($firstCat)) {
                $category = \App\Models\Category::firstOrCreate([
                    'user_id' => $accountId,
                    'name' => $firstCat,
                ]);
                $categoryId = $category->id;
            }
        }

        // 1. Search for existing product by wc_product_id or SKU
        $product = Product::where('user_id', $accountId)
            ->where(function ($query) use ($wcId, $sku) {
                $query->where('wc_product_id', $wcId);
                if ($sku) {
                    $query->orWhere('barcode', $sku)->orWhere('code', $sku);
                }
            })
            ->first();

        if ($product) {
            // Update existing product
            $updateData = [
                'name' => $name,
                'wc_product_id' => $wcId,
            ];
            if ($regularPrice !== null) {
                $updateData['regular_price'] = $regularPrice;
            }
            if ($salePrice > 0) {
                $updateData['sale_price'] = $salePrice;
            }
            if ($sku && empty($product->barcode)) {
                $updateData['barcode'] = $sku;
            }
            if ($categoryId) {
                $updateData['category_id'] = $categoryId;
            }
            if ($imageUrl) {
                $updateData['image_url'] = $imageUrl;
            }

            $product->update($updateData);

            if ($importStock && !$isVariable && (float)$product->quantity == 0 && !empty($wcProduct['manage_stock']) && isset($wcProduct['stock_quantity']) && (float)$wcProduct['stock_quantity'] > 0) {
                $this->stockService->recordMovement(
                    $user,
                    $product,
                    'IN',
                    'INITIAL',
                    $product->id,
                    (float)$wcProduct['stock_quantity'],
                    $product->purchase_price,
                    'رصيد أول المدة مستورد من ووكومرس',
                    branchId: $integration->online_branch_id
                );
            }

            if ($isVariable) {
                $this->syncVariations($user, $integration, $product, $wcId, $importStock);
            }

            return 'updated';
        }

        // 2. Create new product
        $initialQty = 0;
        if ($importStock && !$isVariable && !empty($wcProduct['manage_stock']) && isset($wcProduct['stock_quantity']) && (float)$wcProduct['stock_quantity'] > 0) {
            $initialQty = (float)$wcProduct['stock_quantity'];
        }

        $productData = [
            'name' => $name,
            'category_id' => $categoryId,
            'code' => $sku,
            'barcode' => $sku,
            'purchase_price' => 0,
            'regular_price' => $regularPrice,
            'sale_price' => $salePrice,
            'quantity' => $initialQty,
            'min_quantity' => 5,
            'unit' => 'قطعة',
            'wc_product_id' => $wcId,
            'image_url' => $imageUrl,
            'type' => $isVariable ? 'VARIABLE' : 'STANDARD',
        ];

        if ($isVariable) {
            $variations = $this->apiClient->getProductVariations($integration, $wcId);
            $variantsPayload = [];

            foreach ($variations as $var) {
                $attributes = $this->extractAttributes($var['attributes'] ?? []);
                $varRegularPrice = isset($var['regular_price']) && is_numeric($var['regular_price']) ? (float) $var['regular_price'] : null;
                $varPrice = $this->resolveSellingPrice($var, $salePrice);
                $varSku = !empty($var['sku']) ? trim($var['sku']) : null;
                $varImageUrl = !empty($var['image']['src']) ? (string) $var['image']['src'] : $imageUrl;

                $varQty = 0;
                if ($importStock && !empty($var['manage_stock']) && isset($var['stock_quantity']) && (float)$var['stock_quantity'] > 0) {
                    $varQty = (float)$var['stock_quantity'];
                }

                $variantsPayload[] = [
                    'name' => $attributes['name'] ?: "متغير #{$var['id']}",
                    'size' => $attributes['size'],
                    'color' => $attributes['color'],
                    'barcode' => $varSku,
                    'code' => $varSku,
                    'purchase_price' => 0,
                    'regular_price' => $varRegularPrice,
                    'sale_price' => $varPrice,
                    'quantity' => $varQty,
                    'min_quantity' => 2,
                    'wc_variation_id' => (int) $var['id'],
                    'image_url' => $varImageUrl,
                ];
            }

            $productData['variants'] = $variantsPayload;
        }

        $this->productService->createProduct($user, $productData);

        return 'created';
    }

    /**
     * Synchronize variations for an existing variable product
     */
    protected function syncVariations(User $user, WooCommerceIntegration $integration, Product $product, int $wcId, bool $importStock = false): void
    {
        $variations = $this->apiClient->getProductVariations($integration, $wcId);

        foreach ($variations as $var) {
            $varId = (int) $var['id'];
            $varSku = !empty($var['sku']) ? trim($var['sku']) : null;
            $varRegularPrice = isset($var['regular_price']) && is_numeric($var['regular_price']) ? (float) $var['regular_price'] : null;
            $varPrice = $this->resolveSellingPrice($var, (float) $product->sale_price);
            $attributes = $this->extractAttributes($var['attributes'] ?? []);
            $varImageUrl = !empty($var['image']['src']) ? (string) $var['image']['src'] : $product->image_url;

            $variant = $product->variants()
                ->where(function ($query) use ($varId, $varSku) {
                    $query->where('wc_variation_id', $varId);
                    if ($varSku) {
                        $query->orWhere('barcode', $varSku)->orWhere('code', $varSku);
                    }
                })
                ->first();

            if ($variant) {
                $variantUpdate = [
                    'wc_variation_id' => $varId,
                    'name' => $attributes['name'] ?: $variant->name,
                    'size' => $attributes['size'] ?: $variant->size,
                    'color' => $attributes['color'] ?: $variant->color,
                    'sale_price' => $varPrice > 0 ? $varPrice : $variant->sale_price,
                    'barcode' => $varSku ?: $variant->barcode,
                ];
                if ($varRegularPrice !== null) {
                    $variantUpdate['regular_price'] = $varRegularPrice;
                }
                if ($varImageUrl) {
                    $variantUpdate['image_url'] = $varImageUrl;
                }
                $variant->update($variantUpdate);

                if ($importStock && (float)$variant->quantity == 0 && !empty($var['manage_stock']) && isset($var['stock_quantity']) && (float)$var['stock_quantity'] > 0) {
                    $this->stockService->recordMovement(
                        $user,
                        $product,
                        'IN',
                        'INITIAL',
                        $product->id,
                        (float)$var['stock_quantity'],
                        $variant->purchase_price,
                        'رصيد أول المدة للمتغير مستورد من ووكومرس',
                        variant: $variant,
                        branchId: $integration->online_branch_id
                    );
                }
            } else {
                $varQty = 0;
                if ($importStock && !empty($var['manage_stock']) && isset($var['stock_quantity']) && (float)$var['stock_quantity'] > 0) {
                    $varQty = (float)$var['stock_quantity'];
                }

                $newVar = $product->variants()->create([
                    'user_id' => $user->getAccountId(),
                    'wc_variation_id' => $varId,
                    'name' => $attributes['name'] ?: "متغير #{$varId}",
                    'size' => $attributes['size'],
                    'color' => $attributes['color'],
                    'barcode' => $varSku,
                    'code' => $varSku,
                    'purchase_price' => 0,
                    'regular_price' => $varRegularPrice,
                    'sale_price' => $varPrice,
                    'quantity' => 0,
                    'min_quantity' => 2,
                    'image_url' => $varImageUrl,
                ]);

                if ($varQty > 0) {
                    $this->stockService->recordMovement(
                        $user,
                        $product,
                        'IN',
                        'INITIAL',
                        $product->id,
                        $varQty,
                        $newVar->purchase_price,
                        'رصيد أول المدة للمتغير مستورد من ووكومرس',
                        variant: $newVar,
                        branchId: $integration->online_branch_id
                    );
                }
            }
        }
    }

    /**
     * Resolve active selling price from WooCommerce item (promotional sale_price / active price, falling back to regular_price)
     */
    protected function resolveSellingPrice(array $wcItem, ?float $fallback = 0): float
    {
        if (isset($wcItem['price']) && is_numeric($wcItem['price']) && (float) $wcItem['price'] > 0) {
            return (float) $wcItem['price'];
        }
        if (isset($wcItem['sale_price']) && is_numeric($wcItem['sale_price']) && (float) $wcItem['sale_price'] > 0) {
            return (float) $wcItem['sale_price'];
        }
        if (isset($wcItem['regular_price']) && is_numeric($wcItem['regular_price']) && (float) $wcItem['regular_price'] > 0) {
            return (float) $wcItem['regular_price'];
        }
        return (float) ($fallback ?? 0);
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
