<?php

namespace App\Http\Resources\Easyfy;

use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EasyfyVariantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isAdmin = (bool) $request->user()?->is_admin;

        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'sku' => $this->sku,
            'label' => $this->label,
            'attributes' => $this->attributes ?? [],
            'cost_price' => $this->when($isAdmin, fn () => Money::of($this->cost_price ?? 0)->getAmount()),
            'selling_price' => Money::of($this->selling_price ?? 0)->getAmount(),
            'compare_at_price' => $this->compare_at_price !== null ? Money::of($this->compare_at_price)->getAmount() : null,
            'stock_quantity' => (int) $this->stock_quantity,
            'low_stock_threshold' => (int) $this->low_stock_threshold,
            'min_order_qty' => (int) $this->min_order_qty,
            'is_active' => (bool) $this->is_active,
            'product' => $this->whenLoaded('product', fn () => [
                'id' => $this->product->id,
                'name' => $this->product->name,
                'stock_mode' => $this->product->stock_mode?->value ?? $this->product->stock_mode,
                'is_active' => (bool) $this->product->is_active,
            ]),
            'price_tiers' => $this->whenLoaded('priceTiers', fn () => $this->mapPriceTiers()),
            'stock_movements' => $this->whenLoaded('stockMovements', fn () => $this->mapStockMovements()),
        ];
    }

    private function mapPriceTiers(): array
    {
        return $this->priceTiers->map(fn ($t) => [
            'id' => $t->id,
            'min_qty' => (int) $t->min_qty,
            'unit_price' => Money::of($t->unit_price)->getAmount(),
        ])->values()->all();
    }

    private function mapStockMovements(): array
    {
        return $this->stockMovements->map(fn ($m) => [
            'id' => $m->id,
            'type' => $m->type?->value ?? $m->type,
            'type_label' => $m->type?->label(),
            'quantity_delta' => (int) $m->quantity_delta,
            'balance_after' => (int) $m->balance_after,
            'unit_cost' => $m->unit_cost !== null ? Money::of($m->unit_cost)->getAmount() : null,
            'notes' => $m->notes,
            'created_at' => $m->created_at?->toIso8601String(),
        ])->values()->all();
    }
}
