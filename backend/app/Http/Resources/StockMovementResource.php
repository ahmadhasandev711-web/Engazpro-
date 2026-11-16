<?php

namespace App\Http\Resources;

use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StockMovementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $m = $this->resource;
        $user = $request->user();
        $hidePrice = $user?->isMandob() ?? false;

        return [
            'id' => $m->id,
            'branch_id' => $m->branch_id,
            'branch_name' => $m->branch?->name,
            'product_id' => $m->product_id,
            'product_name' => $m->product?->name,
            'product_code' => $m->product?->code,
            'unit' => $m->product?->unit,
            'product_variant_id' => $m->product_variant_id,
            'variant_name' => $m->variant?->name,
            'product_batch_id' => $m->product_batch_id,
            'batch_number' => $m->batch?->batch_number,
            'type' => $m->type,
            'source_type' => $m->source_type,
            'source_id' => $m->source_id,
            'quantity' => Quantity::of($m->quantity ?? 0)->toFloat(),
            'balance_after' => Quantity::of($m->balance_after ?? 0)->toFloat(),
            'unit_price' => $hidePrice || $m->unit_price === null ? null : Money::of($m->unit_price)->getAmount(),
            'notes' => $m->notes,
            'created_at' => $m->created_at?->toIso8601String(),
        ];
    }
}
