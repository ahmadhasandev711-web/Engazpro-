<?php

namespace App\Services;

use App\Enums\StockMovementSource;
use App\Enums\StockMovementType;
use App\Exceptions\InsufficientStockException;
use App\Exceptions\PosDomainException;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Support\Facades\DB;

class StockService
{
    public function __construct(
        protected ?SettingService $settingService = null
    ) {
        $this->settingService ??= app(SettingService::class);
    }

    /**
     * تسجيل حركة مخزون وتحديث رصيد الصنف والمتغير والفرع بشكل متسق
     */
    public function recordMovement(
        User $user,
        Product $product,
        string $type, // IN, OUT
        string $sourceType, // PURCHASE, SALE, PURCHASE_RETURN, SALE_RETURN, ADJUSTMENT, INITIAL, TRANSFER_IN, TRANSFER_OUT
        ?int $sourceId,
        float $quantity,
        ?float $unitPrice = null,
        ?string $notes = null,
        ?ProductVariant $variant = null,
        ?ProductBatch $batch = null,
        ?int $branchId = null
    ): StockMovement {
        if ($quantity <= 0) {
            throw new PosDomainException('الكمية يجب أن تكون أكبر من صفر.', 'INVALID_QUANTITY');
        }

        $branchId ??= $user->branch_id;
        $lockedProduct = Product::where('id', $product->id)->lockForUpdate()->first() ?? $product;
        $balanceAfter = $this->adjustLockedEntityStock($lockedProduct, $type, $quantity, fn($cur) => "الرصيد المتاح من الصنف '{$lockedProduct->name}' غير كافٍ لإتمام العملية (الرصيد الحالي: {$cur}).");
        $notes = $this->applySecondaryStockTargets($user, $product, $variant, $batch, $branchId, $type, $quantity, $notes);

        return $this->createStockMovementRecord($user, $branchId, $product, $variant, $batch, $type, $sourceType, $sourceId, $quantity, $balanceAfter, $unitPrice, $notes);
    }

    private function applySecondaryStockTargets(User $user, Product $product, ?ProductVariant $variant, ?ProductBatch $batch, ?int $branchId, string $type, float $quantity, ?string $notes): ?string
    {
        if ($variant) {
            $lockedVar = ProductVariant::where('id', $variant->id)->lockForUpdate()->first() ?? $variant;
            $this->adjustLockedEntityStock($lockedVar, $type, $quantity, fn($cur) => "الرصيد المتاح من المتغير غير كافٍ (الرصيد الحالي: {$cur}).");
        }
        if ($batch) {
            $lockedBatch = ProductBatch::where('id', $batch->id)->lockForUpdate()->first() ?? $batch;
            $this->adjustLockedEntityStock($lockedBatch, $type, $quantity, fn($cur) => "الرصيد المتاح من التشغيلة '{$lockedBatch->batch_number}' غير كافٍ (الرصيد الحالي: {$cur}).");
        }

        $isShortSelling = $branchId ? $this->adjustBranchStock($user, $product, $variant, $branchId, $type, $quantity) : false;

        return $isShortSelling ? trim(($notes ? $notes . ' ' : '') . '[بيع على المكشوف]') : $notes;
    }

    private function adjustLockedEntityStock($entity, string $type, float $quantity, callable $errorBuilder): float
    {
        $currentQty = Quantity::of($entity->quantity ?? 0)->toFloat();
        if ($type === StockMovementType::OUT->value && $currentQty < $quantity) {
            throw new PosDomainException($errorBuilder($currentQty), 'INSUFFICIENT_STOCK');
        }

        $newQty = ($type === StockMovementType::IN->value) ? $currentQty + $quantity : $currentQty - $quantity;
        $entity->quantity = $newQty;
        $entity->save();

        return $newQty;
    }

    private function adjustBranchStock(User $user, Product $product, ?ProductVariant $variant, int $branchId, string $type, float $quantity): bool
    {
        $branchStock = $this->lockOrCreateBranchStock($branchId, $product, $variant);
        $currentBranchQty = Quantity::of($branchStock->quantity ?? 0)->toFloat();
        $isShortSelling = false;

        if ($type === StockMovementType::OUT->value && $currentBranchQty < $quantity) {
            if (!$this->settingService->allowsNegativeBranchStock($user)) {
                $branchName = Branch::find($branchId)?->name ?: "الفرع #{$branchId}";
                throw new InsufficientStockException($product->name, $currentBranchQty, $quantity, 'INSUFFICIENT_BRANCH_STOCK', "الرصيد المتاح في فرع '{$branchName}' للصنف '{$product->name}' غير كافٍ لإتمام العملية (الرصيد الحالي: {$currentBranchQty}، المطلوب: {$quantity}).");
            }
            $isShortSelling = true;
        }

        $branchStock->quantity = ($type === StockMovementType::IN->value) ? $currentBranchQty + $quantity : $currentBranchQty - $quantity;
        $branchStock->save();

        return $isShortSelling;
    }

    private function lockOrCreateBranchStock(int $branchId, Product $product, ?ProductVariant $variant): BranchStock
    {
        $query = BranchStock::where('branch_id', $branchId)->where('product_id', $product->id)->where('product_variant_id', $variant?->id);
        $branchStock = (clone $query)->lockForUpdate()->first();
        if ($branchStock) {
            return $branchStock;
        }

        BranchStock::firstOrCreate(
            ['branch_id' => $branchId, 'product_id' => $product->id, 'product_variant_id' => $variant?->id],
            ['quantity' => 0, 'min_quantity' => $variant?->min_quantity ?? $product->min_quantity]
        );

        return $query->lockForUpdate()->firstOrFail();
    }

    private function createStockMovementRecord(User $user, ?int $branchId, Product $product, ?ProductVariant $variant, ?ProductBatch $batch, string $type, string $sourceType, ?int $sourceId, float $quantity, float $balanceAfter, ?float $unitPrice, ?string $notes): StockMovement
    {
        return StockMovement::create([
            'user_id' => $user->getAccountId(), 'branch_id' => $branchId, 'product_id' => $product->id,
            'product_variant_id' => $variant?->id, 'product_batch_id' => $batch?->id,
            'type' => $type, 'source_type' => $sourceType, 'source_id' => $sourceId,
            'quantity' => $quantity, 'balance_after' => $balanceAfter, 'unit_price' => $unitPrice, 'notes' => $notes,
        ]);
    }

    /**
     * تسجيل رصيد أول المدة لدفعة من الأصناف والمتغيرات في فرع محدد
     */
    public function recordOpeningBalance(User $user, int $branchId, array $items): array
    {
        $accountId = $user->getAccountId();

        return DB::transaction(function () use ($user, $accountId, $branchId, $items) {
            $branch = Branch::where('id', $branchId)->where('user_id', $accountId)->firstOrFail();
            $processedCount = 0;

            foreach ($items as $item) {
                if ($this->processOpeningBalanceItem($user, $accountId, $branch, $item)) {
                    $processedCount++;
                }
            }

            return [
                'updated_count' => $processedCount,
                'branch_id' => $branch->id,
                'branch_name' => $branch->name,
            ];
        });
    }

    private function processOpeningBalanceItem(User $user, int $accountId, Branch $branch, array $item): bool
    {
        $quantity = Quantity::of($item['quantity'] ?? 0)->toFloat();
        if ($quantity <= 0) {
            return false;
        }

        $product = Product::where('id', $item['product_id'])->where('user_id', $accountId)->lockForUpdate()->firstOrFail();
        $costPrice = isset($item['cost_price']) && is_numeric($item['cost_price']) ? Money::of($item['cost_price'])->getAmount() : null;
        $variant = $this->resolveOpeningVariant($product, $accountId, $item['product_variant_id'] ?? null, $costPrice);

        if (!$variant && $costPrice !== null && $costPrice > 0) {
            $product->update(['purchase_price' => $costPrice]);
        }

        $unitPrice = $costPrice ?? ($variant?->purchase_price ?? $product->purchase_price);
        $notes = 'رصيد أول المدة - فرع: ' . $branch->name . ($variant ? ' (' . $variant->name . ')' : '');
        $this->recordMovement($user, $product, StockMovementType::IN->value, StockMovementSource::INITIAL->value, null, $quantity, $unitPrice, $notes, $variant, null, $branch->id);

        return true;
    }

    private function resolveOpeningVariant(Product $product, int $accountId, ?int $variantId, ?float $costPrice): ?ProductVariant
    {
        if (!$variantId) {
            return null;
        }

        $variant = ProductVariant::where('id', $variantId)->where('product_id', $product->id)->where('user_id', $accountId)->lockForUpdate()->firstOrFail();
        if ($costPrice !== null && $costPrice > 0) {
            $variant->update(['purchase_price' => $costPrice]);
        }

        return $variant;
    }
}
