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
            'quantity' => Quantity::of($this->quantity ?? 0)->toFloat(),
            'unit_price' => Money::of($this->unit_price ?? 0)->getAmount(),
            'total' => Money::of($this->total ?? 0)->getAmount(),
        ];
    }
}
