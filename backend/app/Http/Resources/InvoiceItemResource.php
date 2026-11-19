<?php

namespace App\Http\Resources;

use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product_name' => $this->product_name,
            'product_code' => $this->product_code,
            'product_variant_id' => $this->product_variant_id,
            'variant_name' => $this->variant_name,
            'product_batch_id' => $this->product_batch_id,
            'batch_number' => $this->batch_number,
            'expiry_date' => $this->expiry_date?->format('Y-m-d'),
            'unit_name' => $this->unit_name,
            'quantity' => Quantity::of($this->quantity ?? 0)->toFloat(),
            'returned_quantity' => Quantity::of($this->returned_quantity ?? 0)->toFloat(),
            'returnable_quantity' => Quantity::of($this->returnable_quantity ?? ($this->quantity ?? 0))->toFloat(),
            'unit_price' => Money::of($this->unit_price ?? 0)->getAmount(),
            'effective_return_unit_price' => Money::of($this->effective_return_unit_price ?? ($this->unit_price ?? 0))->getAmount(),
            'total' => Money::of($this->total ?? 0)->getAmount(),
        ];
    }
}
