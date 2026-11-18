<?php

namespace App\Http\Resources;

use App\Enums\ProductType;
use App\Enums\StockMovementSource;
use App\Services\ProductImageService;
use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $canViewProfit = $user && $user->canViewProfits();
        $branchId = $request->input('branch_id') ?: ($user && ($user->isCashier() || $user->isMandob()) ? $user->branch_id : null);

        return [
            ...$this->coreAttributes($canViewProfit, $branchId),
            'variants' => $this->formatVariants($canViewProfit, $branchId),
            'batches' => $this->formatBatches($canViewProfit),
            'has_movements' => $this->hasMovements($request),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    private function coreAttributes(bool $canViewProfit, ?int $branchId): array
    {
        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'category_name' => $this->category?->name,
            'type' => $this->type ?? ProductType::STANDARD->value,
            'has_expiry' => (bool) $this->has_expiry,
            'has_variants' => (bool) $this->has_variants,
            'code' => $this->code,
            'barcode' => $this->barcode,
            'name' => $this->name,
            'unit' => $this->unit,
            'sub_unit' => $this->sub_unit,
            'sub_unit_factor' => $this->sub_unit_factor !== null ? Quantity::of($this->sub_unit_factor)->toFloat() : null,
            'sub_unit_price' => $this->nullableAmount($this->sub_unit_price),
            'purchase_price' => $canViewProfit ? $this->nullableAmount($this->purchase_price) : null,
            'regular_price' => $this->nullableAmount($this->regular_price),
            'sale_price' => Money::of($this->sale_price ?? 0)->getAmount(),
            'min_sale_price' => $this->nullableAmount($this->min_sale_price),
            'quantity' => $this->resolveEffectiveQuantity($branchId),
            'min_quantity' => $this->min_quantity !== null ? Quantity::of($this->min_quantity)->toFloat() : null,
            'is_low_stock' => $this->isLowStock(),
            'wc_product_id' => $this->wc_product_id,
            'image_url' => ProductImageService::toPublicUrl($this->image_url),
            'notes' => $this->notes,
        ];
    }

    private function resolveEffectiveQuantity(?int $branchId): float
    {
        if (!$this->has_variants && !$branchId) {
            return Quantity::of($this->quantity ?? 0)->toFloat();
        }
        if ($this->has_variants) {
            if ($branchId) {
                $qty = $this->relationLoaded('branchStocks')
                    ? $this->branchStocks->filter(fn($bs) => (int) $bs->branch_id === (int) $branchId && !empty($bs->product_variant_id))->sum('quantity')
                    : $this->branchStocks()->where('branch_id', $branchId)->whereNotNull('product_variant_id')->sum('quantity');
                return Quantity::of($qty)->toFloat();
            }
            $qty = $this->relationLoaded('variants') ? $this->variants->sum('quantity') : $this->variants()->sum('quantity');
            return Quantity::of($qty)->toFloat();
        }
        $branchStock = $this->relationLoaded('branchStocks')
            ? $this->branchStocks->first(fn($bs) => (int) $bs->branch_id === (int) $branchId && empty($bs->product_variant_id))
            : $this->branchStocks()->where('branch_id', $branchId)->whereNull('product_variant_id')->first();
        return $branchStock ? Quantity::of($branchStock->quantity ?? 0)->toFloat() : 0.0;
    }

    private function formatVariants(bool $canViewProfit, ?int $branchId): mixed
    {
        if (!$this->relationLoaded('variants') && !$this->has_variants) {
            return [];
        }

        return $this->variants->map(fn($v) => [
            'id' => $v->id,
            'name' => $v->name,
            'color' => $v->color,
            'size' => $v->size,
            'barcode' => $v->barcode,
            'code' => $v->code,
            'purchase_price' => $canViewProfit ? $this->nullableAmount($v->purchase_price) : null,
            'regular_price' => $this->nullableAmount($v->regular_price),
            'sale_price' => $v->getEffectiveSalePrice(),
            'quantity' => $this->resolveVariantQuantity($v, $branchId),
            'min_quantity' => $v->min_quantity !== null ? Quantity::of($v->min_quantity)->toFloat() : null,
            'is_low_stock' => $v->isLowStock(),
            'wc_variation_id' => $v->wc_variation_id,
            'image_url' => ProductImageService::toPublicUrl($v->image_url),
        ]);
    }

    private function resolveVariantQuantity(mixed $variant, ?int $branchId): float
    {
        if (!$branchId) {
            return Quantity::of($variant->quantity ?? 0)->toFloat();
        }
        $stock = $this->relationLoaded('branchStocks')
            ? $this->branchStocks->first(fn($bs) => (int) $bs->branch_id === (int) $branchId && (int) $bs->product_variant_id === (int) $variant->id)
            : $this->branchStocks()->where('branch_id', $branchId)->where('product_variant_id', $variant->id)->first();
        return $stock ? Quantity::of($stock->quantity ?? 0)->toFloat() : 0.0;
    }

    private function formatBatches(bool $canViewProfit): mixed
    {
        if (!$this->relationLoaded('batches') && !$this->has_expiry) {
            return [];
        }

        return $this->batches->map(fn($b) => [
            'id' => $b->id,
            'product_variant_id' => $b->product_variant_id,
            'batch_number' => $b->batch_number,
            'expiry_date' => $b->expiry_date?->format('Y-m-d'),
            'production_date' => $b->production_date?->format('Y-m-d'),
            'quantity' => Quantity::of($b->quantity ?? 0)->toFloat(),
            'purchase_price' => $canViewProfit ? $this->nullableAmount($b->purchase_price) : null,
            'sale_price' => $b->getEffectiveSalePrice(),
            'is_expired' => $b->isExpired(),
            'is_near_expiry' => $b->isNearExpiry(),
            'status' => $b->expiry_status,
            'notes' => $b->notes,
        ]);
    }

    private function hasMovements(Request $request): bool
    {
        if ($request->attributes->get('pos_catalog')) {
            return false;
        }
        $hasInvoices = isset($this->invoice_items_exists)
            ? (bool) $this->invoice_items_exists
            : ($this->relationLoaded('invoiceItems') ? $this->invoiceItems->isNotEmpty() : $this->invoiceItems()->exists());
        $hasNonInitialStock = isset($this->non_initial_stock_movements_exists)
            ? (bool) $this->non_initial_stock_movements_exists
            : ($this->relationLoaded('stockMovements')
                ? $this->stockMovements->where('source_type', '!=', StockMovementSource::INITIAL->value)->isNotEmpty()
                : $this->stockMovements()->where('source_type', '!=', StockMovementSource::INITIAL->value)->exists());
        return $hasInvoices || $hasNonInitialStock;
    }

    private function nullableAmount(mixed $value): ?float
    {
        return $value !== null ? Money::of($value)->getAmount() : null;
    }
}
