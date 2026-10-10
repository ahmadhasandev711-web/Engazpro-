<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Exceptions\PosDomainException;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class StockService
{
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
        $currentQty = (float) $lockedProduct->quantity;

        if ($type === 'OUT' && $currentQty < $quantity) {
            throw new PosDomainException("الرصيد المتاح من الصنف '{$lockedProduct->name}' غير كافٍ لإتمام العملية (الرصيد الحالي: {$currentQty}).", 'INSUFFICIENT_STOCK');
        }

        // تحديث إجمالي كمية الصنف التراكمي
        $balanceAfter = ($type === 'IN') ? $currentQty + $quantity : $currentQty - $quantity;
        $lockedProduct->quantity = $balanceAfter;
        $lockedProduct->save();

        // تحديث كمية المتغير إن وجد مع القفل التشاؤمي
        if ($variant) {
            $lockedVariant = ProductVariant::where('id', $variant->id)->lockForUpdate()->first() ?? $variant;
            $varQty = (float) $lockedVariant->quantity;
            if ($type === 'OUT' && $varQty < $quantity) {
                throw new PosDomainException("الرصيد المتاح من المتغير غير كافٍ (الرصيد الحالي: {$varQty}).", 'INSUFFICIENT_STOCK');
            }
            $lockedVariant->quantity = ($type === 'IN') ? $varQty + $quantity : $varQty - $quantity;
            $lockedVariant->save();
        }

        // تحديث كمية التشغيلة / تاريخ الصلاحية إن وجدت مع القفل التشاؤمي
        if ($batch) {
            $lockedBatch = ProductBatch::where('id', $batch->id)->lockForUpdate()->first() ?? $batch;
            $batchQty = (float) $lockedBatch->quantity;
            if ($type === 'OUT' && $batchQty < $quantity) {
                throw new PosDomainException("الرصيد المتاح من التشغيلة '{$lockedBatch->batch_number}' غير كافٍ (الرصيد الحالي: {$batchQty}).", 'INSUFFICIENT_STOCK');
            }
            $lockedBatch->quantity = ($type === 'IN') ? $batchQty + $quantity : $batchQty - $quantity;
            $lockedBatch->save();
        }

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
            }

            $branchStock->quantity = ($type === 'IN')
                ? (float) $branchStock->quantity + $quantity
                : (float) $branchStock->quantity - $quantity;
            $branchStock->save();
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
            $branch = Branch::where('id', $branchId)
                ->where('user_id', $accountId)
                ->firstOrFail();

            $processedCount = 0;

            foreach ($items as $item) {
                $productId = $item['product_id'];
                $variantId = $item['product_variant_id'] ?? null;
                $quantity = (float) ($item['quantity'] ?? 0);
                $costPrice = isset($item['cost_price']) && is_numeric($item['cost_price']) ? (float) $item['cost_price'] : null;

                if ($quantity <= 0) {
                    continue;
                }

                $product = Product::where('id', $productId)
                    ->where('user_id', $accountId)
                    ->lockForUpdate()
                    ->firstOrFail();

                $variant = null;
                if ($variantId) {
                    $variant = ProductVariant::where('id', $variantId)
                        ->where('product_id', $product->id)
                        ->where('user_id', $accountId)
                        ->lockForUpdate()
                        ->firstOrFail();

                    if ($costPrice !== null && $costPrice > 0) {
                        $variant->purchase_price = $costPrice;
                        $variant->save();
                    }
                } elseif ($costPrice !== null && $costPrice > 0) {
                    $product->purchase_price = $costPrice;
                    $product->save();
                }

                $unitPrice = $costPrice ?? ($variant?->purchase_price ?? $product->purchase_price);

                $notes = 'رصيد أول المدة - فرع: ' . $branch->name;
                if ($variant) {
                    $notes .= ' (' . $variant->name . ')';
                }

                $this->recordMovement(
                    user: $user,
                    product: $product,
                    type: 'IN',
                    sourceType: 'INITIAL',
                    sourceId: null,
                    quantity: $quantity,
                    unitPrice: $unitPrice,
                    notes: $notes,
                    variant: $variant,
                    branchId: $branchId
                );

                $processedCount++;
            }

            return [
                'updated_count' => $processedCount,
                'branch_id' => $branch->id,
                'branch_name' => $branch->name,
            ];
        });
    }
}
