<?php

namespace App\Services\Easyfy;

use App\Enums\AdminAuditAction;
use App\Enums\Easyfy\EasyfyStockMode;
use App\Enums\Easyfy\EasyfyStockMovementType;
use App\Exceptions\PosDomainException;
use App\Models\Easyfy\EasyfyProductVariant;
use App\Models\Easyfy\EasyfyStockMovement;
use App\Models\User;
use App\Services\AdminAuditService;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

class EasyfyStockService
{
    public function __construct(private readonly AdminAuditService $auditService) {}

    public function getInventoryOverview(): array
    {
        $variants = EasyfyProductVariant::with(['product:id,name,stock_mode,is_active', 'stockMovements' => fn ($q) => $q->limit(3)])
            ->whereHas('product', fn ($q) => $q->where('stock_mode', EasyfyStockMode::TRACKED->value))
            ->orderBy('stock_quantity')
            ->get();

        $lowStock = $variants->filter(fn ($v) => $v->stock_quantity <= $v->low_stock_threshold)->values();

        return ['variants' => $variants, 'low_stock_count' => $lowStock->count()];
    }

    public function adjustStock(
        User $admin,
        int $variantId,
        EasyfyStockMovementType $type,
        int $quantityDelta,
        ?string $unitCost = null,
        ?string $notes = null
    ): EasyfyProductVariant {
        return DB::transaction(function () use ($admin, $variantId, $type, $quantityDelta, $unitCost, $notes) {
            $variant = EasyfyProductVariant::with('product')->lockForUpdate()->findOrFail($variantId);
            if ($variant->product->stock_mode !== EasyfyStockMode::TRACKED) {
                throw new PosDomainException('لا يمكن تسجيل حركة مخزون لصنف غير مضبوط على نظام المخزون الفعلي.', 'EASYFY_NOT_TRACKED', 422);
            }
            $newBalance = $variant->stock_quantity + $quantityDelta;
            if ($newBalance < 0) {
                throw new PosDomainException('الرصيد الناتج لا يمكن أن يكون سالباً.', 'EASYFY_NEGATIVE_STOCK', 422);
            }
            $costVal = $unitCost !== null ? Money::of($unitCost)->getAmount() : $variant->cost_price;
            $variant->update(['stock_quantity' => $newBalance, 'cost_price' => $costVal]);
            EasyfyStockMovement::create([
                'variant_id' => $variant->id, 'type' => $type, 'quantity_delta' => $quantityDelta,
                'balance_after' => $newBalance, 'unit_cost' => $costVal, 'created_by' => $admin->id,
                'notes' => $notes ?: $type->label(), 'created_at' => now(),
            ]);
            $this->auditService->record(AdminAuditAction::EASYFY_STOCK_ADJUSTED, "تعديل مخزون ({$variant->sku})", null, ['delta' => $quantityDelta], EasyfyProductVariant::class, $variant->id, $admin);

            return $variant->fresh(['product', 'stockMovements']);
        });
    }
}
