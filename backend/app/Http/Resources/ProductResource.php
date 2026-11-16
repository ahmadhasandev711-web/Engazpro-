<?php

namespace App\Http\Resources;

use App\Enums\ProductType;
use App\Enums\StockMovementSource;
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

        // حساب الرصيد الفعلي للصنف بحسب سياق الفرع والمتغيرات إن وجدت
        $effectiveQuantity = Quantity::of($this->quantity ?? 0)->toFloat();
        if ($this->has_variants) {
            if ($branchId) {
                $effectiveQuantity = $this->relationLoaded('branchStocks')
                    ? Quantity::of($this->branchStocks->filter(fn($bs) => (int) $bs->branch_id === (int) $branchId && !empty($bs->product_variant_id))->sum('quantity'))->toFloat()
                    : Quantity::of($this->branchStocks()->where('branch_id', $branchId)->whereNotNull('product_variant_id')->sum('quantity'))->toFloat();
            } else {
                $effectiveQuantity = $this->relationLoaded('variants')
                    ? Quantity::of($this->variants->sum('quantity'))->toFloat()
                    : Quantity::of($this->variants()->sum('quantity'))->toFloat();
            }
        } elseif ($branchId) {
            $branchStock = $this->relationLoaded('branchStocks')
                ? $this->branchStocks->first(fn($bs) => (int) $bs->branch_id === (int) $branchId && empty($bs->product_variant_id))
                : $this->branchStocks()->where('branch_id', $branchId)->whereNull('product_variant_id')->first();
            $effectiveQuantity = $branchStock ? Quantity::of($branchStock->quantity ?? 0)->toFloat() : 0.0;
        }

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
            'sub_unit_price' => $this->sub_unit_price !== null ? Money::of($this->sub_unit_price)->getAmount() : null,
            'purchase_price' => $canViewProfit ? ($this->purchase_price !== null ? Money::of($this->purchase_price)->getAmount() : null) : null,
            'regular_price' => $this->regular_price !== null ? Money::of($this->regular_price)->getAmount() : null,
            'sale_price' => Money::of($this->sale_price ?? 0)->getAmount(),
            'min_sale_price' => $this->min_sale_price !== null ? Money::of($this->min_sale_price)->getAmount() : null,
            'quantity' => $effectiveQuantity,
            'min_quantity' => $this->min_quantity !== null ? Quantity::of($this->min_quantity)->toFloat() : null,
            'is_low_stock' => $this->isLowStock(),
            'wc_product_id' => $this->wc_product_id,
            'notes' => $this->notes,
            'variants' => $this->relationLoaded('variants') || $this->has_variants ? $this->variants->map(function ($v) use ($canViewProfit, $branchId) {
                $varQty = Quantity::of($v->quantity ?? 0)->toFloat();
                if ($branchId) {
                    $vBranchStock = $this->relationLoaded('branchStocks')
                        ? $this->branchStocks->first(fn($bs) => (int) $bs->branch_id === (int) $branchId && (int) $bs->product_variant_id === (int) $v->id)
                        : $this->branchStocks()->where('branch_id', $branchId)->where('product_variant_id', $v->id)->first();
                    $varQty = $vBranchStock ? Quantity::of($vBranchStock->quantity ?? 0)->toFloat() : 0.0;
                }

                return [
                    'id' => $v->id,
                    'name' => $v->name,
                    'color' => $v->color,
                    'size' => $v->size,
                    'barcode' => $v->barcode,
                    'code' => $v->code,
                    'purchase_price' => $canViewProfit ? ($v->purchase_price !== null ? Money::of($v->purchase_price)->getAmount() : null) : null,
                    'regular_price' => $v->regular_price !== null ? Money::of($v->regular_price)->getAmount() : null,
                    'sale_price' => $v->getEffectiveSalePrice(),
                    'quantity' => $varQty,
                    'min_quantity' => $v->min_quantity !== null ? Quantity::of($v->min_quantity)->toFloat() : null,
                    'is_low_stock' => $v->isLowStock(),
                    'wc_variation_id' => $v->wc_variation_id,
                ];
            }) : [],
            'batches' => $this->relationLoaded('batches') || $this->has_expiry ? $this->batches->map(fn($b) => [
                'id' => $b->id,
                'product_variant_id' => $b->product_variant_id,
                'batch_number' => $b->batch_number,
                'expiry_date' => $b->expiry_date?->format('Y-m-d'),
                'production_date' => $b->production_date?->format('Y-m-d'),
                'quantity' => Quantity::of($b->quantity ?? 0)->toFloat(),
                'purchase_price' => $canViewProfit ? ($b->purchase_price !== null ? Money::of($b->purchase_price)->getAmount() : null) : null,
                'sale_price' => $b->getEffectiveSalePrice(),
                'is_expired' => $b->isExpired(),
                'is_near_expiry' => $b->isNearExpiry(),
                'status' => $b->expiry_status,
                'notes' => $b->notes,
            ]) : [],
            'has_movements' => $request->attributes->get('pos_catalog') ? false : (bool) (
                (isset($this->invoice_items_exists)
                    ? (bool) $this->invoice_items_exists
                    : ($this->relationLoaded('invoiceItems') ? $this->invoiceItems->isNotEmpty() : $this->invoiceItems()->exists()))
                ||
                (isset($this->non_initial_stock_movements_exists)
                    ? (bool) $this->non_initial_stock_movements_exists
                    : ($this->relationLoaded('stockMovements')
                        ? $this->stockMovements->where('source_type', '!=', StockMovementSource::INITIAL->value)->isNotEmpty()
                        : $this->stockMovements()->where('source_type', '!=', StockMovementSource::INITIAL->value)->exists()))
            ),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
