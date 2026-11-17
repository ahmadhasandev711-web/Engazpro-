<?php

namespace App\Services;

use App\Enums\ProductType;
use App\Enums\StockMovementSource;
use App\Enums\StockMovementType;
use App\Exceptions\PosDomainException;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\Quantity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class ProductService
{
    public function __construct(
        protected StockService $stockService,
        protected BarcodeService $barcodeService
    ) {}

    /**
     * Create a new product and record initial stock if quantity > 0.
     */
    public function createProduct(User $user, array $data, ?int $branchId = null): Product
    {
        $initialQty = Quantity::of($data['quantity'] ?? 0)->toFloat();
        $variantsData = $data['variants'] ?? [];
        $batchesData = $data['batches'] ?? [];
        unset($data['variants'], $data['batches']);

        $this->validateProductBarcodes($user, $data['barcode'] ?? null, $variantsData);

        return DB::transaction(function () use ($user, $data, $initialQty, $variantsData, $batchesData, $branchId) {
            $product = Product::create($this->prepareProductAttributes($user, $data));

            if (!empty($variantsData)) {
                $this->createVariantsWithStock($user, $product, $variantsData, $branchId);
            } elseif (!empty($batchesData)) {
                $this->createBatchesWithStock($user, $product, $batchesData, $branchId);
            } elseif ($initialQty > 0) {
                $this->stockService->recordMovement($user, $product, StockMovementType::IN->value, StockMovementSource::INITIAL->value, $product->id, $initialQty, $product->purchase_price, 'رصيد افتتاحي عند إضافة الصنف', null, null, $branchId);
            }

            return $product->refresh()->load(['variants', 'batches']);
        });
    }

    private function prepareProductAttributes(User $user, array $data): array
    {
        $data['quantity'] = 0;
        $data['user_id'] = $user->getAccountId();
        if (($data['type'] ?? null) === ProductType::VARIABLE->value) {
            $data['has_variants'] = true;
        } elseif (($data['type'] ?? null) === ProductType::EXPIRY->value) {
            $data['has_expiry'] = true;
        }

        return $data;
    }

    private function validateProductBarcodes(User $user, ?string $mainBarcode, ?array $variantsData, ?int $ignoreProductId = null): void
    {
        $seen = [];
        if (!empty($mainBarcode)) {
            $trimmed = trim($mainBarcode);
            if (!$this->barcodeService->validateUniqueBarcode($user, $trimmed, null, $ignoreProductId)) {
                throw new \App\Exceptions\DuplicateBarcodeException($trimmed);
            }
            $seen[] = $trimmed;
        }
        foreach ($variantsData ?? [] as $var) {
            $varBarcode = trim($var['barcode'] ?? '');
            if ($varBarcode === '') {
                continue;
            }
            if (in_array($varBarcode, $seen, true)) {
                throw new \App\Exceptions\DuplicateBarcodeException($varBarcode, "الباركود ({$varBarcode}) مكرر في مصفوفة المتغيرات.");
            }
            $seen[] = $varBarcode;
            $varId = !empty($var['id']) ? (int) $var['id'] : null;
            if (!$this->barcodeService->validateUniqueBarcode($user, $varBarcode, $varId, $ignoreProductId)) {
                throw new \App\Exceptions\DuplicateBarcodeException($varBarcode);
            }
        }
    }

    private function createVariantsWithStock(User $user, Product $product, array $variantsData, ?int $branchId): void
    {
        foreach ($variantsData as $varData) {
            $varQty = Quantity::of($varData['quantity'] ?? 0)->toFloat();
            $variant = $product->variants()->create(array_merge($varData, ['quantity' => 0, 'user_id' => $user->getAccountId(), 'product_id' => $product->id]));
            if ($varQty > 0) {
                $this->stockService->recordMovement($user, $product, StockMovementType::IN->value, StockMovementSource::INITIAL->value, $product->id, $varQty, $variant->purchase_price ?? $product->purchase_price, 'رصيد افتتاحي للمتغير: ' . $variant->name, $variant, null, $branchId);
            }
        }
    }

    private function createBatchesWithStock(User $user, Product $product, array $batchesData, ?int $branchId): void
    {
        foreach ($batchesData as $batchData) {
            $batchQty = Quantity::of($batchData['quantity'] ?? 0)->toFloat();
            $batch = $product->batches()->create(array_merge($batchData, ['quantity' => 0, 'user_id' => $user->getAccountId(), 'product_id' => $product->id]));
            if ($batchQty > 0) {
                $this->stockService->recordMovement($user, $product, StockMovementType::IN->value, StockMovementSource::INITIAL->value, $product->id, $batchQty, $batch->purchase_price ?? $product->purchase_price, 'رصيد افتتاحي للتشغيلة: ' . $batch->batch_number, null, $batch, $branchId);
            }
        }
    }

    /**
     * Update product details (protecting stock quantity from arbitrary edits).
     */
    public function updateProduct(Product $product, array $data): Product
    {
        $variantsData = $data['variants'] ?? null;
        $user = auth()->user() ?? $product->user;
        unset($data['quantity'], $data['variants'], $data['batches']);

        $this->validateProductBarcodes($user, $data['barcode'] ?? null, $variantsData, $product->id);

        return DB::transaction(function () use ($product, $data, $variantsData, $user) {
            $product->update($data);
            if ($variantsData !== null) {
                $this->syncProductVariants($user, $product, $variantsData);
            }

            return $product->fresh(['variants', 'batches']);
        });
    }

    private function syncProductVariants(User $user, Product $product, array $variantsData): void
    {
        $sentIds = collect($variantsData)->pluck('id')->filter()->all();
        foreach ($product->variants()->whereNotIn('id', $sentIds)->get() as $oldVar) {
            $hasSales = $oldVar->invoiceItems()->exists() || $oldVar->stockMovements()->where('source_type', '!=', StockMovementSource::INITIAL->value)->exists();
            if ($hasSales) {
                throw new PosDomainException("لا يمكن حذف المتغير ({$oldVar->name}) لوجود فواتير أو حركات مخزون سابقة مرتبطة به.", 'VARIANT_HAS_MOVEMENTS', 422);
            }
            $oldVar->delete();
        }

        foreach ($variantsData as $varData) {
            if (!empty($varData['id']) && ($variant = $product->variants()->find($varData['id']))) {
                unset($varData['quantity']);
                $variant->update($varData);
                continue;
            }
            $varQty = Quantity::of($varData['quantity'] ?? 0)->toFloat();
            $variant = $product->variants()->create(array_merge($varData, ['quantity' => 0, 'user_id' => $product->user_id, 'product_id' => $product->id]));
            if ($varQty > 0) {
                $this->stockService->recordMovement($user, $product, StockMovementType::IN->value, StockMovementSource::INITIAL->value, $product->id, $varQty, $variant->purchase_price ?? $product->purchase_price, 'رصيد افتتاحي للمتغير: ' . $variant->name, $variant);
            }
        }
    }

    /**
     * Add a new batch with initial stock to an existing product
     */
    public function addBatch(User $user, Product $product, array $batchData): \App\Models\ProductBatch
    {
        return DB::transaction(function () use ($user, $product, $batchData) {
            $batchQty = Quantity::of($batchData['quantity'] ?? 0)->toFloat();
            $batchDataToSave = $batchData;
            $batchDataToSave['quantity'] = 0;
            $batchDataToSave['user_id'] = $user->getAccountId();
            $batchDataToSave['product_id'] = $product->id;

            $batch = $product->batches()->create($batchDataToSave);

            if ($batchQty > 0) {
                $this->stockService->recordMovement(
                    $user,
                    $product,
                    StockMovementType::IN->value,
                    StockMovementSource::INITIAL->value,
                    $product->id,
                    $batchQty,
                    $batch->purchase_price ?? $product->purchase_price,
                    'توريد تشغيلة جديدة: ' . $batch->batch_number,
                    null,
                    $batch
                );
            }

            return $batch;
        });
    }

    /**
     * Safely delete a product if it has no associated invoices or non-initial movements.
     */
    public function deleteProduct(Product $product): bool
    {
        $hasInvoices = $product->invoiceItems()->exists();
        $hasMovements = $product->stockMovements()->where('source_type', '!=', StockMovementSource::INITIAL->value)->exists();

        if ($hasInvoices || $hasMovements) {
            throw new PosDomainException(
                message: 'لا يمكن حذف هذا الصنف لوجود حركات وفواتير مرتبطة به، يمكنك تعديل بياناته أو تصفير كميته بدلاً من حذفه.',
                errorCode: 'PRODUCT_HAS_MOVEMENTS',
                statusCode: 422
            );
        }

        return (bool) $product->delete();
    }

    /**
     * استعلام قائمة الأصناف مع البحث والفلترة والتصفح والعزل حسب الفرع
     */
    public function getProductsPaginated(?User $user, array $filters = []): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $branchId = ($user && ($user->isCashier() || $user->isMandob()))
            ? $user->branch_id
            : (!empty($filters['branch_id']) ? (int) $filters['branch_id'] : null);

        $query = Product::with(['category', 'variants', 'batches'])
            ->withExists([
                'invoiceItems',
                'stockMovements as non_initial_stock_movements_exists' => fn($smq) => $smq->where('source_type', '!=', StockMovementSource::INITIAL->value),
            ])
            ->when($branchId, fn($q) => $q->with(['branchStocks' => fn($bsq) => $bsq->where('branch_id', $branchId)]));

        $this->applyProductFilters($query, $filters);

        return $query->orderBy('name')->paginate(min((int) ($filters['per_page'] ?? 20), 500));
    }

    /**
     * @return array<string, int>
     */
    public function getProductsSummary(array $filters = []): array
    {
        $baseQuery = Product::query();
        $this->applySearchAndCategoryFilters($baseQuery, $filters);

        $variableType = ProductType::VARIABLE->value;
        $expiryType = ProductType::EXPIRY->value;
        $row = (clone $baseQuery)->selectRaw(
            'COUNT(*) as all_count,
            COALESCE(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END), 0) as variable_count,
            COALESCE(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END), 0) as expiry_count,
            COALESCE(SUM(CASE WHEN min_quantity IS NOT NULL AND quantity <= min_quantity THEN 1 ELSE 0 END), 0) as low_stock_count',
            [$variableType, $expiryType]
        )->first();

        $nearExpiryCount = (clone $baseQuery)
            ->whereHas('batches', fn ($bq) => $bq->where('quantity', '>', 0)->where('expiry_date', '<=', now()->addDays(60))->where('expiry_date', '>=', now()->startOfDay()))
            ->count();

        return [
            'all_count' => (int) ($row?->all_count ?? 0),
            'variable_count' => (int) ($row?->variable_count ?? 0),
            'expiry_count' => (int) ($row?->expiry_count ?? 0),
            'near_expiry_count' => $nearExpiryCount,
            'low_stock_count' => (int) ($row?->low_stock_count ?? 0),
        ];
    }

    private function applySearchAndCategoryFilters(Builder $query, array $filters): void
    {
        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(fn($q) => $q->where('name', 'like', "%{$search}%")->orWhere('barcode', 'like', "%{$search}%")->orWhere('code', 'like', "%{$search}%")
                ->orWhereHas('variants', fn($vq) => $vq->where('barcode', 'like', "%{$search}%")->orWhere('code', 'like', "%{$search}%")->orWhere('name', 'like', "%{$search}%")));
        }
        if (!empty($filters['category_id'])) {
            $query->where('category_id', (int) $filters['category_id']);
        }
    }

    private function applyProductFilters(Builder $query, array $filters): void
    {
        $this->applySearchAndCategoryFilters($query, $filters);
        if (!empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }
        if (!empty($filters['low_stock']) && filter_var($filters['low_stock'], FILTER_VALIDATE_BOOLEAN)) {
            $query->whereNotNull('min_quantity')->whereColumn('quantity', '<=', 'min_quantity');
        }
        if (!empty($filters['near_expiry']) && filter_var($filters['near_expiry'], FILTER_VALIDATE_BOOLEAN)) {
            $query->whereHas('batches', fn($bq) => $bq->where('quantity', '>', 0)->where('expiry_date', '<=', now()->addDays(60))->where('expiry_date', '>=', now()->startOfDay()));
        }
        if (!empty($filters['expired']) && filter_var($filters['expired'], FILTER_VALIDATE_BOOLEAN)) {
            $query->whereHas('batches', fn($bq) => $bq->where('quantity', '>', 0)->where('expiry_date', '<', now()->startOfDay()));
        }
    }

    public function getPosCatalog(?User $user, array $filters = []): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $branchId = $this->resolveCatalogBranchId($user, $filters);
        $query = Product::query()->with($this->posCatalogRelations($branchId));
        $this->applyPosCatalogFilters($query, $filters);
        $perPage = min(max((int) ($filters['per_page'] ?? 48), 1), 60);

        return $query->orderBy('name')->paginate($perPage);
    }

    public function findByScanCode(User $user, string $code, ?int $branchId): ?array
    {
        $code = trim($code);
        if ($code === '') {
            return null;
        }

        $resolvedBranchId = $this->resolveCatalogBranchId($user, ['branch_id' => $branchId]);
        $with = $this->posCatalogRelations($resolvedBranchId);
        $product = $this->findProductByExactCode($code, $with);

        if ($product) {
            return ['product' => $product, 'variant_id' => null];
        }

        $variant = ProductVariant::query()
            ->where(function (Builder $query) use ($code) {
                $query->where('barcode', $code)->orWhere('code', $code);
            })
            ->first();

        if (!$variant) {
            return null;
        }

        $parent = Product::with($with)->find($variant->product_id);

        return $parent ? ['product' => $parent, 'variant_id' => $variant->id] : null;
    }

    private function resolveCatalogBranchId(?User $user, array $filters): ?int
    {
        if ($user && ($user->isCashier() || $user->isMandob())) {
            return $user->branch_id ? (int) $user->branch_id : null;
        }

        return !empty($filters['branch_id']) ? (int) $filters['branch_id'] : null;
    }

    private function posCatalogRelations(?int $branchId): array
    {
        $with = ['category', 'variants', 'batches'];
        if ($branchId) {
            $with['branchStocks'] = function ($query) use ($branchId) {
                $query->where('branch_id', $branchId);
            };
        }

        return $with;
    }

    private function applyPosCatalogFilters(Builder $query, array $filters): void
    {
        $term = trim((string) ($filters['search'] ?? ''));
        if ($term !== '') {
            $this->applyPosSearch($query, $term);
        }

        if (!empty($filters['category_id'])) {
            $query->where('category_id', (int) $filters['category_id']);
        }
    }

    private function applyPosSearch(Builder $query, string $term): void
    {
        $like = '%'.$this->escapeLike($term).'%';
        $prefix = $this->escapeLike($term).'%';

        $query->where(function (Builder $inner) use ($term, $like, $prefix) {
            $inner->where('barcode', $term)
                ->orWhere('code', $term)
                ->orWhere('name', 'like', $prefix)
                ->orWhere('name', 'like', $like)
                ->orWhere('barcode', 'like', $prefix)
                ->orWhere('code', 'like', $prefix)
                ->orWhereHas('variants', function (Builder $variantQuery) use ($term, $like, $prefix) {
                    $variantQuery->where('barcode', $term)
                        ->orWhere('code', $term)
                        ->orWhere('name', 'like', $like)
                        ->orWhere('barcode', 'like', $prefix)
                        ->orWhere('code', 'like', $prefix);
                });
        });
    }

    private function findProductByExactCode(string $code, array $with): ?Product
    {
        return Product::with($with)->where('barcode', $code)->first()
            ?? Product::with($with)->where('code', $code)->first();
    }

    public function findOrFail(int $id): Product
    {
        return Product::findOrFail($id);
    }

    public function findForShowOrFail(int $id): Product
    {
        return Product::with(['category', 'stockMovements' => function ($q) {
            $q->latest()->limit(20);
        }])
            ->withExists([
                'invoiceItems',
                'stockMovements as non_initial_stock_movements_exists' => function ($q) {
                    $q->where('source_type', '!=', StockMovementSource::INITIAL->value);
                },
            ])
            ->findOrFail($id);
    }

    public function loadProductDetails(Product $product): Product
    {
        $product->load('category');
        $product->loadExists([
            'invoiceItems',
            'stockMovements as non_initial_stock_movements_exists' => function ($q) {
                $q->where('source_type', '!=', StockMovementSource::INITIAL->value);
            },
        ]);

        return $product;
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
