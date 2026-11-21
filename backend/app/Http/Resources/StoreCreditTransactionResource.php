<?php

namespace App\Http\Resources;

use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StoreCreditTransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type instanceof \BackedEnum ? $this->type->value : $this->type,
            'amount' => Money::of($this->amount ?? 0)->getAmount(),
            'balance_after' => Money::of($this->balance_after ?? 0)->getAmount(),
            'exchange_id' => $this->exchange_id,
            'exchange_number' => $this->exchange?->exchange_number,
            'invoice_id' => $this->invoice_id,
            'invoice_number' => $this->invoice?->invoice_number,
            'created_by_name' => $this->creator?->name,
            'expires_at' => $this->expires_at?->toIso8601String(),
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
