<?php

namespace App\Services\EasyOrders;

use App\Contracts\EasyOrdersApiClientInterface;
use App\Enums\ProductType;
use App\Enums\StockMovementSource;
use App\Enums\StockMovementType;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Category;
use App\Models\EasyOrdersIntegration;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\ProductService;
use App\Services\StockService;
use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Support\Facades\DB;

class EasyOrdersProductImportService
{
    public function __construct(
        protected EasyOrdersApiClientInterface $apiClient,
        protected ProductService $productService,
        protected StockService $stockService
    ) {}

    public function importProducts(User $user, EasyOrdersIntegration $integration, bool $importStock = false): array
    {
        return EasyOrdersStockSyncGate::suppressDuring($integration->user_id, function () use ($user, $integration, $importStock) {
            return $this->runPagedImport($user, $integration, $importStock);
        });
    }

    private function runPagedImport(User $user, EasyOrdersIntegration $integration, bool $importStock): array
    {
        $page = 1;
        $totals = ['imported' => 0, 'updated' => 0, 'errors' => []];
        $branchId = $this->resolveTargetBranchId($integration);

        do {
            $res = $this->apiClient->getProductsPage($integration, $page, 20);
            $this->processProductsBatch($user, $res['products'], $branchId, $importStock, $totals);
            $page++;
        } while ($res['has_next_page'] && $page <= 25);

        $integration->update([
            'last_synced_at' => now(),
            'last_error' => !empty($totals['errors']) ? $totals['errors'][0] : null,
        ]);

        return $totals;
    }

    private function processProductsBatch(User $user, array $nodes, ?int $branchId, bool $importStock, array &$totals): void
    {
        foreach ($nodes as $node) {
            try {
                $action = DB::transaction(fn () => $this->syncSingleProduct($user, $node, $branchId, $importStock));
                if ($action === 'created') {
                    $totals['imported']++;
                } elseif ($action === 'updated') {
                    $totals['updated']++;
                }
            } catch (\Throwable $e) {
                $totals['errors'][] = ($node['name'] ?? 'Product') . ': ' . $e->getMessage();
            }
        }
    }

    public function syncSingleProduct(User $user, array $node, ?int $branchId, bool $importStock = false): string
    {
        $extId = trim((string) ($node['id'] ?? ''));
        $name = trim((string) ($node['name'] ?? ''));
        if ($extId === '' || $name === '' || !empty($node['is_deleted'])) {
            return 'skipped';
        }

        $variants = is_array($node['variants'] ?? null) ? array_values(array_filter($node['variants'], 'is_array')) : [];
        $categoryId = $this->resolveCategoryId($user->getAccountId(), $node);

        return count($variants) > 0
            ? $this->upsertVariableProduct($user, $node, $extId, $name, $categoryId, $variants, $branchId, $importStock)
            : $this->upsertSimpleProduct($user, $node, $extId, $name, $categoryId, $branchId, $importStock);
    }

    private function upsertSimpleProduct(User $user, array $node, string $extId, string $name, ?int $categoryId, ?int $branchId, bool $importStock): string
    {
        $prices = $this->resolvePrices($node);
        $sku = !empty($node['sku']) ? trim((string) $node['sku']) : null;
        $taagerCode = !empty($node['taager_code']) ? trim((string) $node['taager_code']) : null;
        $product = $this->findExistingProduct($user->getAccountId(), $extId, $sku);
        $action = $product ? 'updated' : 'created';
        $attrs = ['name' => $name, 'easyorders_product_id' => $extId, 'easyorders_sku' => $sku, 'easyorders_taager_code' => $taagerCode, 'regular_price' => $prices['regular_price'], 'sale_price' => $prices['sale_price'], 'category_id' => $categoryId, 'image_url' => $node['thumb'] ?? null];

        if ($product) {
            $product->update(array_filter([...$attrs, 'barcode' => empty($product->barcode) ? $sku : null], fn ($v) => $v !== null));
        } else {
            $product = $this->productService->createProduct($user, [...$attrs, 'code' => $sku, 'barcode' => $sku, 'purchase_price' => 0, 'quantity' => 0, 'min_quantity' => 5, 'unit' => 'قطعة', 'type' => ProductType::STANDARD->value], $branchId);
        }
        $this->applyInitialStock($user, $product, null, $branchId, (int) ($node['quantity'] ?? 0), $importStock);

        return $action;
    }

    private function upsertVariableProduct(User $user, array $node, string $extId, string $name, ?int $categoryId, array $variants, ?int $branchId, bool $importStock): string
    {
        $prices = $this->resolvePrices($node);
        $sku = !empty($node['sku']) ? trim((string) $node['sku']) : null;
        $taagerCode = !empty($node['taager_code']) ? trim((string) $node['taager_code']) : null;
        $product = $this->findExistingProduct($user->getAccountId(), $extId, $sku);
        $action = $product ? 'updated' : 'created';
        $attrs = ['name' => $name, 'easyorders_product_id' => $extId, 'easyorders_sku' => $sku, 'easyorders_taager_code' => $taagerCode, 'category_id' => $categoryId, 'image_url' => $node['thumb'] ?? null, 'regular_price' => $prices['regular_price'], 'sale_price' => $prices['sale_price'], 'type' => ProductType::VARIABLE->value, 'has_variants' => true];

        if ($product) {
            $product->update(array_filter($attrs, fn ($v) => $v !== null));
        } else {
            $product = $this->productService->createProduct($user, [...$attrs, 'purchase_price' => 0, 'quantity' => 0, 'min_quantity' => 5, 'unit' => 'قطعة', 'variants' => []], $branchId);
        }
        foreach ($variants as $var) {
            $this->syncVariant($user, $product, $var, $node['thumb'] ?? null, $branchId, $importStock);
        }

        return $action;
    }

    private function syncVariant(User $user, Product $product, array $var, ?string $parentThumb, ?int $branchId, bool $importStock): void
    {
        $varId = trim((string) ($var['id'] ?? ''));
        $tCode = !empty($var['taager_code']) ? trim((string) $var['taager_code']) : null;
        $prices = $this->resolvePrices($var);
        $label = $this->extractVariantLabel($var) ?: ('متغير ' . substr($varId, 0, 8));
        $variant = $this->findExistingVariant($product, $varId, $tCode);
        $attrs = ['easyorders_variant_id' => $varId ?: null, 'easyorders_taager_code' => $tCode, 'name' => $label, 'regular_price' => $prices['regular_price'], 'sale_price' => $prices['sale_price'], 'image_url' => $parentThumb];

        if ($variant) {
            $variant->update(array_filter($attrs, fn ($v) => $v !== null));
        } else {
            $variant = $product->variants()->create([...$attrs, 'user_id' => $user->getAccountId(), 'code' => $tCode, 'barcode' => $tCode, 'purchase_price' => 0, 'quantity' => 0, 'min_quantity' => 2]);
        }
        $this->applyInitialStock($user, $product, $variant, $branchId, (int) ($var['quantity'] ?? 0), $importStock);
    }

    private function findExistingProduct(int $accountId, string $extId, ?string $sku): ?Product
    {
        return Product::where('user_id', $accountId)->where(function ($q) use ($extId, $sku) {
            $q->where('easyorders_product_id', $extId);
            if ($sku) {
                $q->orWhere('easyorders_sku', $sku)->orWhere('code', $sku)->orWhere('barcode', $sku);
            }
        })->first();
    }

    private function findExistingVariant(Product $product, string $varId, ?string $tCode): ?ProductVariant
    {
        return $product->variants()->where(function ($q) use ($varId, $tCode) {
            if ($varId !== '') {
                $q->where('easyorders_variant_id', $varId);
            }
            if ($tCode) {
                $q->orWhere('easyorders_taager_code', $tCode)->orWhere('code', $tCode)->orWhere('barcode', $tCode);
            }
        })->first();
    }

    private function resolveCategoryId(int $accountId, array $node): ?int
    {
        $catName = trim((string) ($node['categories'][0]['name'] ?? ''));

        return $catName !== '' ? Category::firstOrCreate(['user_id' => $accountId, 'name' => $catName])->id : null;
    }

    /**
     * @return array{sale_price: float, regular_price: float}
     */
    private function resolvePrices(array $node): array
    {
        $price = Money::of($node['price'] ?? 0);
        $saleRaw = Money::of($node['sale_price'] ?? 0);
        $effectiveSale = ($saleRaw->isPositive() && $saleRaw->lessThan($price)) ? $saleRaw : $price;

        return ['sale_price' => $effectiveSale->getAmount(), 'regular_price' => $price->getAmount()];
    }

    private function extractVariantLabel(array $var): ?string
    {
        $props = $var['variation_props'] ?? [];
        if (!is_array($props) || empty($props)) {
            return null;
        }
        $parts = collect($props)->map(fn ($p) => trim((string) ($p['variation_prop'] ?? '')))->filter()->all();

        return !empty($parts) ? implode(' - ', $parts) : null;
    }

    private function resolveTargetBranchId(EasyOrdersIntegration $integration): ?int
    {
        if ($integration->default_branch_id) {
            return (int) $integration->default_branch_id;
        }

        return Branch::where('user_id', $integration->user_id)->where('is_main', true)->value('id')
            ?? Branch::where('user_id', $integration->user_id)->value('id');
    }

    private function applyInitialStock(User $user, Product $product, ?ProductVariant $variant, ?int $branchId, int $qty, bool $importStock): void
    {
        if (!$importStock || !$branchId || $qty <= 0) {
            return;
        }
        $existing = BranchStock::withoutGlobalScopes()->where('branch_id', $branchId)->where('product_id', $product->id)
            ->when($variant, fn ($q) => $q->where('product_variant_id', $variant->id), fn ($q) => $q->whereNull('product_variant_id'))
            ->value('quantity');
        if ($existing === null || Quantity::of($existing)->isZero()) {
            $cost = Money::of($variant?->purchase_price ?? $product->purchase_price ?? 0)->getAmount();
            $this->stockService->recordMovement($user, $product, StockMovementType::IN->value, StockMovementSource::INITIAL->value, $product->id, $qty, $cost, 'رصيد أول المدة مستورد من EasyOrders', variant: $variant, branchId: $branchId);
        }
    }
}
