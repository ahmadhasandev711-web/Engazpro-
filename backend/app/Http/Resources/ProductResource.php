<?php

namespace App\Http\Resources;

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
        $effectiveQuantity = (float) $this->quantity;
        if ($this->has_variants) {
            if ($branchId) {
                $effectiveQuantity = $this->relationLoaded('branchStocks')
                    ? (float) $this->branchStocks->filter(fn($bs) => (int) $bs->branch_id === (int) $branchId && !empty($bs->product_variant_id))->sum('quantity')
                    : (float) $this->branchStocks()->where('branch_id', $branchId)->whereNotNull('product_variant_id')->sum('quantity');
            } else {
                $effectiveQuantity = $this->relationLoaded('variants')
                    ? (float) $this->variants->sum('quantity')
                    : (float) $this->variants()->sum('quantity');
            }
        } elseif ($branchId) {
            $branchStock = $this->relationLoaded('branchStocks')
                ? $this->branchStocks->first(fn($bs) => (int) $bs->branch_id === (int) $branchId && empty($bs->product_variant_id))
                : $this->branchStocks()->where('branch_id', $branchId)->whereNull('product_variant_id')->first();
            $effectiveQuantity = $branchStock ? (float) $branchStock->quantity : 0.0;
        }

        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'category_name' => $this->category?->name,
            'type' => $this->type ?? 'STANDARD',
            'has_expiry' => (bool) $this->has_expiry,
            'has_variants' => (bool) $this->has_variants,
            'code' => $this->code,
            'barcode' => $this->barcode,
            'name' => $this->name,
            'unit' => $this->unit,
            'sub_unit' => $this->sub_unit,
            'sub_unit_factor' => $this->sub_unit_factor !== null ? (float) $this->sub_unit_factor : null,
            'sub_unit_price' => $this->sub_unit_price !== null ? (float) $this->sub_unit_price : null,
            'purchase_price' => $canViewProfit ? ($this->purchase_price !== null ? (float) $this->purchase_price : null) : null,
            'regular_price' => $this->regular_price !== null ? (float) $this->regular_price : null,
            'sale_price' => (float) $this->sale_price,
            'min_sale_price' => $this->min_sale_price !== null ? (float) $this->min_sale_price : null,
            'quantity' => $effectiveQuantity,
            'min_quantity' => $this->min_quantity !== null ? (float) $this->min_quantity : null,
            'is_low_stock' => $this->isLowStock(),
            'wc_product_id' => $this->wc_product_id,
            'notes' => $this->notes,
            'variants' => $this->relationLoaded('variants') || $this->has_variants ? $this->variants->map(function ($v) use ($canViewProfit, $branchId) {
                $varQty = (float) $v->quantity;
                if ($branchId) {
                    $vBranchStock = $this->relationLoaded('branchStocks')
                        ? $this->branchStocks->first(fn($bs) => (int) $bs->branch_id === (int) $branchId && (int) $bs->product_variant_id === (int) $v->id)
                        : $this->branchStocks()->where('branch_id', $branchId)->where('product_variant_id', $v->id)->first();
                    $varQty = $vBranchStock ? (float) $vBranchStock->quantity : 0.0;
                }

                return [
                    'id' => $v->id,
                    'name' => $v->name,
                    'color' => $v->color,
                    'size' => $v->size,
                    'barcode' => $v->barcode,
                    'code' => $v->code,
                    'purchase_price' => $canViewProfit ? ($v->purchase_price !== null ? (float) $v->purchase_price : null) : null,
                    'regular_price' => $v->regular_price !== null ? (float) $v->regular_price : null,
                    'sale_price' => (float) $v->getEffectiveSalePrice(),
                    'quantity' => $varQty,
                    'min_quantity' => $v->min_quantity !== null ? (float) $v->min_quantity : null,
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
                'quantity' => (float) $b->quantity,
                'purchase_price' => $canViewProfit ? ($b->purchase_price !== null ? (float) $b->purchase_price : null) : null,
                'sale_price' => (float) $b->getEffectiveSalePrice(),
                'is_expired' => $b->isExpired(),
                'is_near_expiry' => $b->isNearExpiry(),
                'status' => $b->expiry_status,
                'notes' => $b->notes,
            ]) : [],
            'has_movements' => (bool) (
                (isset($this->invoice_items_exists)
                    ? (bool) $this->invoice_items_exists
                    : ($this->relationLoaded('invoiceItems') ? $this->invoiceItems->isNotEmpty() : $this->invoiceItems()->exists()))
                ||
                (isset($this->non_initial_stock_movements_exists)
                    ? (bool) $this->non_initial_stock_movements_exists
                    : ($this->relationLoaded('stockMovements')
                        ? $this->stockMovements->where('source_type', '!=', 'INITIAL')->isNotEmpty()
                        : $this->stockMovements()->where('source_type', '!=', 'INITIAL')->exists()))
            ),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
