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

        // القفل التشاؤمي للمنتج لمنع تضارب التزامن (Race Conditions)
        $lockedProduct = Product::where('id', $product->id)->lockForUpdate()->first() ?? $product;
        $currentQty = Quantity::of($lockedProduct->quantity ?? 0)->toFloat();

        if ($type === StockMovementType::OUT->value && $currentQty < $quantity) {
            throw new PosDomainException("الرصيد المتاح من الصنف '{$lockedProduct->name}' غير كافٍ لإتمام العملية (الرصيد الحالي: {$currentQty}).", 'INSUFFICIENT_STOCK');
        }

        // تحديث إجمالي كمية الصنف التراكمي
        $balanceAfter = ($type === StockMovementType::IN->value) ? $currentQty + $quantity : $currentQty - $quantity;
        $lockedProduct->quantity = $balanceAfter;
        $lockedProduct->save();

        // تحديث كمية المتغير إن وجد مع القفل التشاؤمي
        if ($variant) {
            $lockedVariant = ProductVariant::where('id', $variant->id)->lockForUpdate()->first() ?? $variant;
            $varQty = Quantity::of($lockedVariant->quantity ?? 0)->toFloat();
            if ($type === StockMovementType::OUT->value && $varQty < $quantity) {
                throw new PosDomainException("الرصيد المتاح من المتغير غير كافٍ (الرصيد الحالي: {$varQty}).", 'INSUFFICIENT_STOCK');
            }
            $lockedVariant->quantity = ($type === StockMovementType::IN->value) ? $varQty + $quantity : $varQty - $quantity;
            $lockedVariant->save();
        }

        // تحديث كمية التشغيلة / تاريخ الصلاحية إن وجدت مع القفل التشاؤمي
        if ($batch) {
            $lockedBatch = ProductBatch::where('id', $batch->id)->lockForUpdate()->first() ?? $batch;
            $batchQty = Quantity::of($lockedBatch->quantity ?? 0)->toFloat();
            if ($type === StockMovementType::OUT->value && $batchQty < $quantity) {
                throw new PosDomainException("الرصيد المتاح من التشغيلة '{$lockedBatch->batch_number}' غير كافٍ (الرصيد الحالي: {$batchQty}).", 'INSUFFICIENT_STOCK');
            }
            $lockedBatch->quantity = ($type === StockMovementType::IN->value) ? $batchQty + $quantity : $batchQty - $quantity;
            $lockedBatch->save();
        }

        $isShortSelling = false;
        // تحديث رصيد الفرع (BranchStock) إن وجد فرع محدد مع القفل التشاؤمي
        if ($branchId) {
            $branchStock = BranchStock::where('branch_id', $branchId)
                ->where('product_id', $product->id)
                ->where('product_variant_id', $variant?->id)
                ->lockForUpdate()
                ->first();

            if (!$branchStock) {
                $branchStock = BranchStock::firstOrCreate([
                    'branch_id' => $branchId,
                    'product_id' => $product->id,
                    'product_variant_id' => $variant?->id,
                ], [
                    'quantity' => 0,
                    'min_quantity' => $variant?->min_quantity ?? $product->min_quantity,
                ]);

                $branchStock = BranchStock::where('branch_id', $branchId)
                    ->where('product_id', $product->id)
                    ->where('product_variant_id', $variant?->id)
                    ->lockForUpdate()
                    ->firstOrFail();
            }

            $currentBranchQty = Quantity::of($branchStock->quantity ?? 0)->toFloat();
            if ($type === StockMovementType::OUT->value && $currentBranchQty < $quantity) {
                $allowNegative = $this->settingService->allowsNegativeBranchStock($user);
                if (!$allowNegative) {
                    $branch = Branch::find($branchId);
                    $branchName = $branch?->name ?: "الفرع #{$branchId}";
                    throw new InsufficientStockException(
                        productName: $product->name,
                        available: $currentBranchQty,
                        requested: $quantity,
                        errorCode: 'INSUFFICIENT_BRANCH_STOCK',
                        customMessage: "الرصيد المتاح في فرع '{$branchName}' للصنف '{$product->name}' غير كافٍ لإتمام العملية (الرصيد الحالي: {$currentBranchQty}، المطلوب: {$quantity})."
                    );
                }
                $isShortSelling = true;
            }

            $branchStock->quantity = ($type === StockMovementType::IN->value)
                ? $currentBranchQty + $quantity
                : $currentBranchQty - $quantity;
            $branchStock->save();
        }

        if ($isShortSelling) {
            $notes = trim(($notes ? $notes . ' ' : '') . '[بيع على المكشوف]');
        }

        // إنشاء قيد حركة المخزون
        return StockMovement::create([
            'user_id' => $user->getAccountId(),
            'branch_id' => $branchId,
            'product_id' => $product->id,
            'product_variant_id' => $variant?->id,
            'product_batch_id' => $batch?->id,
            'type' => $type,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'quantity' => $quantity,
            'balance_after' => $balanceAfter,
            'unit_price' => $unitPrice,
            'notes' => $notes,
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
