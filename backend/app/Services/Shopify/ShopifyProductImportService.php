<?php

namespace App\Services\Shopify;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\ProductType;
use App\Enums\StockMovementSource;
use App\Enums\StockMovementType;
use App\Exceptions\ShopifyConnectionException;
use App\Models\BranchStock;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShopifyIntegration;
use App\Models\ShopifyLocationMapping;
use App\Models\User;
use App\Services\ProductService;
use App\Services\StockService;
use App\Support\Money;
use App\Support\Quantity;
use App\Support\ShopifyGid;
use Illuminate\Support\Facades\DB;

class ShopifyProductImportService
{
    public function __construct(
        protected ShopifyGraphqlClientInterface $graphqlClient,
        protected ProductService $productService,
        protected StockService $stockService
    ) {}

    public function importProducts(User $user, ShopifyIntegration $integration, bool $importStock = false): array
    {
        $cursor = null;
        $totals = ['imported' => 0, 'updated' => 0, 'errors' => []];

        do {
            $res = $this->importPage($user, $integration, $cursor, 25, $importStock);
            $totals['imported'] += $res['imported'];
            $totals['updated'] += $res['updated'];
            $totals['errors'] = array_merge($totals['errors'], $res['errors']);
            $cursor = $res['end_cursor'];
        } while ($res['has_more'] && $cursor);

        return $totals;
    }

    public function importPage(User $user, ShopifyIntegration $integration, ?string $cursor = null, int $first = 25, bool $importStock = false): array
    {
        return ShopifyStockSyncGate::suppressDuring($integration->user_id, function () use ($user, $integration, $cursor, $first, $importStock) {
            return $this->processImportPage($user, $integration, $cursor, $first, $importStock);
        });
    }

    private function processImportPage(User $user, ShopifyIntegration $integration, ?string $cursor, int $first, bool $importStock): array
    {
        $page = $this->graphqlClient->getProductsPage($integration, $cursor, $first);
        $locationMap = $this->loadLocationBranchMap($integration);
        $summary = ['imported' => 0, 'updated' => 0, 'errors' => [], 'count' => count($page['products']), 'has_more' => $page['has_next_page'], 'end_cursor' => $page['end_cursor']];

        foreach ($page['products'] as $node) {
            try {
                $action = DB::transaction(fn () => $this->syncSingleProduct($user, $integration, $node, $importStock, $locationMap));
                if ($action === 'created') {
                    $summary['imported']++;
                } elseif ($action === 'updated') {
                    $summary['updated']++;
                }
            } catch (\Throwable $e) {
                $summary['errors'][] = ($node['title'] ?? 'Product') . ': ' . $e->getMessage();
            }
        }
        $integration->update([
            'last_synced_at' => now(),
            'last_error' => !empty($summary['errors']) ? $summary['errors'][0] : null,
        ]);

        return $summary;
    }

    public function syncSingleProduct(User $user, ShopifyIntegration $integration, array $node, bool $importStock = false, ?array $locationMap = null): string
    {
        $title = trim((string) ($node['title'] ?? ''));
        $shopifyProductId = ShopifyGid::extractId($node['id'] ?? null);
        if ($title === '' || !$shopifyProductId || (isset($node['status']) && strtoupper((string) $node['status']) === 'ARCHIVED')) {
            return 'skipped';
        }

        $variants = $this->collectAllVariants($integration, $node);
        if (empty($variants)) {
            return 'skipped';
        }

        $locationMap ??= $this->loadLocationBranchMap($integration);
        $isVariable = $this->isMultiVariantProduct($node, $variants);
        $accountId = $user->getAccountId();
        $categoryId = $this->resolveCategoryId($accountId, $node['productType'] ?? null);
        $imageUrl = $node['featuredMedia']['preview']['image']['url'] ?? null;

        return $isVariable
            ? $this->upsertVariableProduct($user, $integration, $shopifyProductId, $title, $categoryId, $imageUrl, $variants, $importStock, $locationMap)
            : $this->upsertSimpleProduct($user, $integration, $shopifyProductId, $title, $categoryId, $imageUrl, $variants[0], $importStock, $locationMap);
    }

    private function collectAllVariants(ShopifyIntegration $integration, array $node): array
    {
        $variants = collect($node['variants']['edges'] ?? [])->pluck('node')->filter()->values()->all();
        $pageInfo = $node['variants']['pageInfo'] ?? [];
        $hasMore = (bool) ($pageInfo['hasNextPage'] ?? false);
        $cursor = $pageInfo['endCursor'] ?? null;

        while ($hasMore && $cursor && !empty($node['id'])) {
            $next = $this->graphqlClient->getProductVariantsPage($integration, (string) $node['id'], $cursor);
            $variants = array_merge($variants, $next['variants']);
            $hasMore = $next['has_next_page'];
            $cursor = $next['end_cursor'];
        }

        return $variants;
    }

    private function isMultiVariantProduct(array $node, array $variants): bool
    {
        if (isset($node['hasOnlyDefaultVariant'])) {
            return !$node['hasOnlyDefaultVariant'] && count($variants) > 0;
        }

        return count($variants) > 1 || (count($variants) === 1 && ($variants[0]['title'] ?? '') !== 'Default Title');
    }

    private function resolveCategoryId(int $accountId, ?string $rawType): ?int
    {
        $name = html_entity_decode(trim((string) $rawType), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return $name !== '' ? Category::firstOrCreate(['user_id' => $accountId, 'name' => $name])->id : null;
    }

    private function findExistingProduct(int $accountId, int $shopifyProductId, array $variantNodes): ?Product
    {
        $skus = collect($variantNodes)->flatMap(fn ($v) => [trim((string) ($v['sku'] ?? '')), trim((string) ($v['barcode'] ?? ''))])
            ->filter()->unique()->values()->all();

        return Product::where('user_id', $accountId)->where(function ($q) use ($shopifyProductId, $skus) {
            $q->where('shopify_product_id', $shopifyProductId);
            if (!empty($skus)) {
                $q->orWhereIn('barcode', $skus)->orWhereIn('code', $skus);
            }
        })->first();
    }

    private function upsertSimpleProduct(User $user, ShopifyIntegration $integration, int $shopifyProductId, string $title, ?int $categoryId, ?string $imageUrl, array $var, bool $importStock, array $locationMap): string
    {
        $prices = $this->resolveVariantPrices($var);
        $sku = !empty($var['sku']) ? trim((string) $var['sku']) : null;
        $barcode = !empty($var['barcode']) ? trim((string) $var['barcode']) : $sku;
        $ids = [
            'shopify_product_id' => $shopifyProductId,
            'shopify_variant_id' => ShopifyGid::extractId($var['id'] ?? null),
            'shopify_inventory_item_id' => ShopifyGid::extractId($var['inventoryItem']['id'] ?? null),
            'shopify_tracked' => (bool) ($var['inventoryItem']['tracked'] ?? true),
        ];
        $product = $this->findExistingProduct($user->getAccountId(), $shopifyProductId, [$var]);
        $action = $product ? 'updated' : 'created';
        $img = ShopifyGraphqlQueries::extractVariantMediaUrl($var) ?? $imageUrl;

        if ($product) {
            $product->update(array_filter(['name' => $title, ...$ids, 'regular_price' => $prices['regular_price'], 'sale_price' => $prices['sale_price'], 'category_id' => $categoryId, 'image_url' => $img, 'barcode' => empty($product->barcode) ? $barcode : null], fn ($v) => $v !== null));
        } else {
            $product = $this->productService->createProduct($user, ['name' => $title, 'category_id' => $categoryId, 'code' => $sku, 'barcode' => $barcode, 'purchase_price' => 0, 'regular_price' => $prices['regular_price'], 'sale_price' => $prices['sale_price'], 'quantity' => 0, 'min_quantity' => 5, 'unit' => 'قطعة', 'type' => ProductType::STANDARD->value, ...$ids, 'image_url' => $img], $integration->default_branch_id);
        }
        $this->applyLocationInitialStock($user, $integration, $product, null, $var, $importStock, $locationMap);

        return $action;
    }

    private function upsertVariableProduct(User $user, ShopifyIntegration $integration, int $shopifyProductId, string $title, ?int $categoryId, ?string $imageUrl, array $variants, bool $importStock, array $locationMap): string
    {
        $firstPrices = $this->resolveVariantPrices($variants[0]);
        $product = $this->findExistingProduct($user->getAccountId(), $shopifyProductId, $variants);
        $action = $product ? 'updated' : 'created';

        if ($product) {
            $this->assertSafeVariableUpgrade($product, $title);
            $product->update(array_filter([
                'name' => $title, 'shopify_product_id' => $shopifyProductId, 'category_id' => $categoryId,
                'image_url' => $imageUrl, 'regular_price' => $firstPrices['regular_price'], 'sale_price' => $firstPrices['sale_price'],
                'type' => ProductType::VARIABLE->value, 'has_variants' => true,
            ], fn ($v) => $v !== null));
        } else {
            $product = $this->productService->createProduct($user, [
                'name' => $title, 'category_id' => $categoryId, 'purchase_price' => 0,
                'regular_price' => $firstPrices['regular_price'], 'sale_price' => $firstPrices['sale_price'],
                'quantity' => 0, 'min_quantity' => 5, 'unit' => 'قطعة', 'type' => ProductType::VARIABLE->value,
                'shopify_product_id' => $shopifyProductId, 'image_url' => $imageUrl, 'variants' => [],
            ], $integration->default_branch_id);
        }

        foreach ($variants as $var) {
            $this->syncSingleVariation($user, $integration, $product, $var, $imageUrl, $importStock, $locationMap);
        }

        return $action;
    }

    private function assertSafeVariableUpgrade(Product $product, string $title): void
    {
        if ($product->isVariable()) {
            return;
        }
        $hasOrphanedStock = BranchStock::withoutGlobalScopes()
            ->where('product_id', $product->id)
            ->whereNull('product_variant_id')
            ->where('quantity', '>', 0)
            ->exists();

        if ($hasOrphanedStock) {
            throw new ShopifyConnectionException("تعذر تحويل الصنف البسيط '{$title}' إلى متعدد المتغيرات تلقائياً لوجود رصيد حالي غير موزّع على متغيرات.");
        }
    }

    private function syncSingleVariation(User $user, ShopifyIntegration $integration, Product $product, array $var, ?string $parentImage, bool $importStock, array $locationMap): void
    {
        $varId = ShopifyGid::extractId($var['id'] ?? null);
        $invItemId = ShopifyGid::extractId($var['inventoryItem']['id'] ?? null);
        $tracked = (bool) ($var['inventoryItem']['tracked'] ?? true);
        $sku = !empty($var['sku']) ? trim((string) $var['sku']) : null;
        $barcode = !empty($var['barcode']) ? trim((string) $var['barcode']) : $sku;
        $prices = $this->resolveVariantPrices($var);
        $opts = $this->extractVariantOptions($var);
        $img = ShopifyGraphqlQueries::extractVariantMediaUrl($var) ?? $parentImage;
        $variant = $this->findExistingVariant($product, $varId, $sku, $barcode);

        if ($variant) {
            $variant->update(array_filter([
                'shopify_variant_id' => $varId, 'shopify_inventory_item_id' => $invItemId, 'shopify_tracked' => $tracked,
                'name' => $opts['name'] ?: $variant->name, 'size' => $opts['size'] ?: $variant->size,
                'color' => $opts['color'] ?: $variant->color, 'regular_price' => $prices['regular_price'],
                'sale_price' => $prices['sale_price'], 'barcode' => empty($variant->barcode) ? $barcode : null,
                'image_url' => $img,
            ], fn ($v) => $v !== null));
        } else {
            $variant = $product->variants()->create([
                'user_id' => $user->getAccountId(), 'shopify_variant_id' => $varId, 'shopify_inventory_item_id' => $invItemId, 'shopify_tracked' => $tracked,
                'name' => $opts['name'] ?: "متغير #{$varId}", 'size' => $opts['size'], 'color' => $opts['color'],
                'barcode' => $barcode, 'code' => $sku, 'purchase_price' => 0, 'quantity' => 0, 'min_quantity' => 2,
                'regular_price' => $prices['regular_price'], 'sale_price' => $prices['sale_price'], 'image_url' => $img,
            ]);
        }
        $this->applyLocationInitialStock($user, $integration, $product, $variant, $var, $importStock, $locationMap);
    }

    private function findExistingVariant(Product $product, ?int $varId, ?string $sku, ?string $barcode): ?ProductVariant
    {
        return $product->variants()->where(function ($q) use ($varId, $sku, $barcode) {
            if ($varId) {
                $q->where('shopify_variant_id', $varId);
            }
            if ($barcode) {
                $q->orWhere('barcode', $barcode);
            }
            if ($sku) {
                $q->orWhere('code', $sku);
            }
        })->first();
    }

    /**
     * @return array{sale_price: float, regular_price: float}
     */
    private function resolveVariantPrices(array $var): array
    {
        $saleMoney = Money::of($var['price'] ?? 0);
        $rawCompare = $var['compareAtPrice'] ?? null;
        $compareMoney = ($rawCompare !== null && is_numeric($rawCompare)) ? Money::of($rawCompare) : null;
        $regularMoney = ($compareMoney && $compareMoney->greaterThan($saleMoney)) ? $compareMoney : $saleMoney;

        return ['sale_price' => $saleMoney->getAmount(), 'regular_price' => $regularMoney->getAmount()];
    }

    /**
     * @return array{name: string, size: ?string, color: ?string}
     */
    private function extractVariantOptions(array $var): array
    {
        $size = null;
        $color = null;
        $parts = [];

        foreach ($var['selectedOptions'] ?? [] as $opt) {
            $name = strtolower(trim((string) ($opt['name'] ?? '')));
            $val = trim((string) ($opt['value'] ?? ''));
            if ($val === '' || $val === 'Default Title') {
                continue;
            }
            $parts[] = $val;
            if (in_array($name, ['size', 'المقاس', 'مقاس', 'الحجم'], true)) {
                $size = $val;
            } elseif (in_array($name, ['color', 'colour', 'اللون', 'لون'], true)) {
                $color = $val;
            }
        }

        return ['name' => implode(' - ', $parts) ?: (string) ($var['title'] ?? ''), 'size' => $size, 'color' => $color];
    }

    private function applyLocationInitialStock(User $user, ShopifyIntegration $integration, Product $product, ?ProductVariant $variant, array $var, bool $importStock, array $locationMap): void
    {
        if (!$importStock || empty($var['inventoryItem']['tracked'])) {
            return;
        }
        foreach ($var['inventoryItem']['inventoryLevels']['nodes'] ?? [] as $level) {
            $locId = ShopifyGid::extractId($level['location']['id'] ?? null);
            $branchId = array_key_exists($locId, $locationMap) ? $locationMap[$locId] : $integration->default_branch_id;
            $qty = $this->extractAvailableLevelQuantity($level);
            if (!$branchId || !$qty->isPositive()) {
                continue;
            }
            $existing = BranchStock::withoutGlobalScopes()->where('branch_id', $branchId)->where('product_id', $product->id)
                ->when($variant, fn ($q) => $q->where('product_variant_id', $variant->id), fn ($q) => $q->whereNull('product_variant_id'))
                ->value('quantity');
            if ($existing === null || Quantity::of($existing)->isZero()) {
                $cost = Money::of($variant?->purchase_price ?? $product->purchase_price ?? 0)->getAmount();
                $this->stockService->recordMovement($user, $product, StockMovementType::IN->value, StockMovementSource::INITIAL->value, $product->id, $qty->toFloat(), $cost, 'رصيد أول المدة مستورد من Shopify', variant: $variant, branchId: $branchId);
            }
        }
    }

    private function extractAvailableLevelQuantity(array $level): Quantity
    {
        foreach ($level['quantities'] ?? [] as $q) {
            if (($q['name'] ?? 'available') === 'available') {
                return Quantity::of($q['quantity'] ?? 0);
            }
        }

        return Quantity::of($level['quantities'][0]['quantity'] ?? 0);
    }

    /**
     * @return array<int, ?int>
     */
    private function loadLocationBranchMap(ShopifyIntegration $integration): array
    {
        return ShopifyLocationMapping::withoutGlobalScopes()
            ->where('user_id', $integration->user_id)
            ->where('shopify_integration_id', $integration->id)
            ->where('is_active', true)
            ->pluck('branch_id', 'shopify_location_id')
            ->all();
    }
}
