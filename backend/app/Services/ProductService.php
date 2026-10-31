<?php

namespace App\Services;

use App\Exceptions\PosDomainException;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
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
        $initialQty = (float) ($data['quantity'] ?? 0);
        $variantsData = $data['variants'] ?? [];
        $batchesData = $data['batches'] ?? [];

        unset($data['variants'], $data['batches']);

        // فحص باركود الصنف الرئيسي
        if (!empty($data['barcode'])) {
            $mainBarcode = trim($data['barcode']);
            if (!$this->barcodeService->validateUniqueBarcode($user, $mainBarcode)) {
                throw new \App\Exceptions\DuplicateBarcodeException($mainBarcode);
            }
        }

        // فحص باركودات المتغيرات وتفادي التكرار الداخلي أو في المتجر
        $seenBarcodes = [];
        if (!empty($data['barcode'])) {
            $seenBarcodes[] = trim($data['barcode']);
        }

        if (!empty($variantsData)) {
            foreach ($variantsData as $var) {
                $varBarcode = trim($var['barcode'] ?? '');
                if ($varBarcode !== '') {
                    if (in_array($varBarcode, $seenBarcodes, true)) {
                        throw new \App\Exceptions\DuplicateBarcodeException($varBarcode, "الباركود ({$varBarcode}) مكرر في مصفوفة المتغيرات.");
                    }
                    $seenBarcodes[] = $varBarcode;

                    if (!$this->barcodeService->validateUniqueBarcode($user, $varBarcode)) {
                        throw new \App\Exceptions\DuplicateBarcodeException($varBarcode);
                    }
                }
            }
        }

        return DB::transaction(function () use ($user, $data, $initialQty, $variantsData, $batchesData, $branchId) {
            $dataToSave = $data;
            $dataToSave['quantity'] = 0;
            $dataToSave['user_id'] = $user->getAccountId();
            
            if (isset($dataToSave['type'])) {
                if ($dataToSave['type'] === 'VARIABLE') {
                    $dataToSave['has_variants'] = true;
                } elseif ($dataToSave['type'] === 'EXPIRY') {
                    $dataToSave['has_expiry'] = true;
                }
            }

            $product = Product::create($dataToSave);

            // 1. معالجة المتغيرات (Variants)
            if (!empty($variantsData)) {
                foreach ($variantsData as $varData) {
                    $varQty = (float) ($varData['quantity'] ?? 0);
                    $varDataToSave = $varData;
                    $varDataToSave['quantity'] = 0;
                    $varDataToSave['user_id'] = $user->getAccountId();
                    $varDataToSave['product_id'] = $product->id;

                    $variant = $product->variants()->create($varDataToSave);

                    if ($varQty > 0) {
                        $this->stockService->recordMovement(
                            $user,
                            $product,
                            'IN',
                            'INITIAL',
                            $product->id,
                            $varQty,
                            $variant->purchase_price ?? $product->purchase_price,
                            'رصيد افتتاحي للمتغير: ' . $variant->name,
                            $variant,
                            null,
                            $branchId
                        );
                    }
                }
            }
            // 2. معالجة التشغيلات وتواريخ الصلاحية (Batches)
            elseif (!empty($batchesData)) {
                foreach ($batchesData as $batchData) {
                    $batchQty = (float) ($batchData['quantity'] ?? 0);
                    $batchDataToSave = $batchData;
                    $batchDataToSave['quantity'] = 0;
                    $batchDataToSave['user_id'] = $user->getAccountId();
                    $batchDataToSave['product_id'] = $product->id;

                    $batch = $product->batches()->create($batchDataToSave);

                    if ($batchQty > 0) {
                        $this->stockService->recordMovement(
                            $user,
                            $product,
                            'IN',
                            'INITIAL',
                            $product->id,
                            $batchQty,
                            $batch->purchase_price ?? $product->purchase_price,
                            'رصيد افتتاحي للتشغيلة: ' . $batch->batch_number,
                            null,
                            $batch,
                            $branchId
                        );
                    }
                }
            }
            // 3. منتج قياسي (Standard)
            elseif ($initialQty > 0) {
                $this->stockService->recordMovement(
                    $user,
                    $product,
                    'IN',
                    'INITIAL',
                    $product->id,
                    $initialQty,
                    $product->purchase_price,
                    'رصيد افتتاحي عند إضافة الصنف',
                    null,
                    null,
                    $branchId
                );
            }

            return $product->refresh()->load(['variants', 'batches']);
        });
    }

    /**
     * Update product details (protecting stock quantity from arbitrary edits).
     */
    public function updateProduct(Product $product, array $data): Product
    {
        $variantsData = $data['variants'] ?? null;
        $batchesData = $data['batches'] ?? null;
        $user = auth()->user() ?? $product->user;

        unset($data['quantity'], $data['variants'], $data['batches']);

        // فحص باركود الصنف الرئيسي
        if (!empty($data['barcode'])) {
            $mainBarcode = trim($data['barcode']);
            if (!$this->barcodeService->validateUniqueBarcode($user, $mainBarcode, null, $product->id)) {
                throw new \App\Exceptions\DuplicateBarcodeException($mainBarcode);
            }
        }

        // فحص باركودات المتغيرات وتفادي التكرار
        if ($variantsData !== null) {
            $seenBarcodes = [];
            if (!empty($data['barcode'])) {
                $seenBarcodes[] = trim($data['barcode']);
            }

            foreach ($variantsData as $var) {
                $varBarcode = trim($var['barcode'] ?? '');
                $varId = !empty($var['id']) ? (int) $var['id'] : null;

                if ($varBarcode !== '') {
                    if (in_array($varBarcode, $seenBarcodes, true)) {
                        throw new \App\Exceptions\DuplicateBarcodeException($varBarcode, "الباركود ({$varBarcode}) مكرر في مصفوفة المتغيرات.");
                    }
                    $seenBarcodes[] = $varBarcode;

                    if (!$this->barcodeService->validateUniqueBarcode($user, $varBarcode, $varId, $product->id)) {
                        throw new \App\Exceptions\DuplicateBarcodeException($varBarcode);
                    }
                }
            }
        }

        return DB::transaction(function () use ($product, $data, $variantsData, $batchesData, $user) {
            $product->update($data);

            if ($variantsData !== null) {
                // التعامل مع المتغيرات المحذوفة
                $sentVariantIds = collect($variantsData)->pluck('id')->filter()->all();
                $deletedVariants = $product->variants()->whereNotIn('id', $sentVariantIds)->get();

                foreach ($deletedVariants as $oldVar) {
                    $hasSales = $oldVar->invoiceItems()->exists() || $oldVar->stockMovements()->where('source_type', '!=', 'INITIAL')->exists();
                    if ($hasSales) {
                        throw new PosDomainException(
                            message: "لا يمكن حذف المتغير ({$oldVar->name}) لوجود فواتير أو حركات مخزون سابقة مرتبطة به.",
                            errorCode: 'VARIANT_HAS_MOVEMENTS',
                            statusCode: 422
                        );
                    }
                    $oldVar->delete();
                }

                foreach ($variantsData as $varData) {
                    if (!empty($varData['id'])) {
                        $variant = $product->variants()->find($varData['id']);
                        if ($variant) {
                            unset($varData['quantity']);
                            $variant->update($varData);
                        }
                    } else {
                        $varQty = (float) ($varData['quantity'] ?? 0);
                        $varDataToSave = $varData;
                        $varDataToSave['quantity'] = 0;
                        $varDataToSave['user_id'] = $product->user_id;
                        $varDataToSave['product_id'] = $product->id;

                        $variant = $product->variants()->create($varDataToSave);
                        if ($varQty > 0) {
                            $this->stockService->recordMovement(
                                $user,
                                $product,
                                'IN',
                                'INITIAL',
                                $product->id,
                                $varQty,
                                $variant->purchase_price ?? $product->purchase_price,
                                'رصيد افتتاحي للمتغير: ' . $variant->name,
                                $variant
                            );
                        }
                    }
                }
            }

            return $product->fresh(['variants', 'batches']);
        });
    }

    /**
     * Add a new batch with initial stock to an existing product
     */
    public function addBatch(User $user, Product $product, array $batchData): \App\Models\ProductBatch
    {
        return DB::transaction(function () use ($user, $product, $batchData) {
            $batchQty = (float) ($batchData['quantity'] ?? 0);
            $batchDataToSave = $batchData;
            $batchDataToSave['quantity'] = 0;
            $batchDataToSave['user_id'] = $user->getAccountId();
            $batchDataToSave['product_id'] = $product->id;

            $batch = $product->batches()->create($batchDataToSave);

            if ($batchQty > 0) {
                $this->stockService->recordMovement(
                    $user,
                    $product,
                    'IN',
                    'INITIAL',
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
        $hasMovements = $product->stockMovements()->where('source_type', '!=', 'INITIAL')->exists();

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
                'stockMovements as non_initial_stock_movements_exists' => function ($smq) {
                    $smq->where('source_type', '!=', 'INITIAL');
                },
            ]);

        if ($branchId) {
            $query->with(['branchStocks' => function ($bsq) use ($branchId) {
                $bsq->where('branch_id', $branchId);
            }]);
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('barcode', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%")
                  ->orWhereHas('variants', function ($vq) use ($search) {
                      $vq->where('barcode', 'like', "%{$search}%")
                         ->orWhere('code', 'like', "%{$search}%")
                         ->orWhere('name', 'like', "%{$search}%");
                  });
            });
        }

        if (!empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        if (!empty($filters['category_id'])) {
            $query->where('category_id', $filters['category_id']);
        }

        if (!empty($filters['low_stock']) && filter_var($filters['low_stock'], FILTER_VALIDATE_BOOLEAN)) {
            $query->whereNotNull('min_quantity')
                  ->whereColumn('quantity', '<=', 'min_quantity');
        }

        if (!empty($filters['near_expiry']) && filter_var($filters['near_expiry'], FILTER_VALIDATE_BOOLEAN)) {
            $query->whereHas('batches', function ($bq) {
                $bq->where('quantity', '>', 0)
                   ->where('expiry_date', '<=', now()->addDays(60))
                   ->where('expiry_date', '>=', now()->startOfDay());
            });
        }

        if (!empty($filters['expired']) && filter_var($filters['expired'], FILTER_VALIDATE_BOOLEAN)) {
            $query->whereHas('batches', function ($bq) {
                $bq->where('quantity', '>', 0)
                   ->where('expiry_date', '<', now()->startOfDay());
            });
        }

        $perPage = min((int) ($filters['per_page'] ?? 20), 500);
        return $query->orderBy('name')->paginate($perPage);
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

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
