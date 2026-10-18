<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'party_id' => $this->party_id,
            'party_name' => $this->party?->name,
            'party_type' => $this->party?->type,
            'party_phone' => $this->party?->phone,
            'party_balance' => (float) ($this->party?->balance ?? 0),
            'invoice_id' => $this->invoice_id,
            'invoice_number' => $this->invoice?->invoice_number,
            'type' => $this->type instanceof \BackedEnum ? $this->type->value : $this->type,
            'amount' => (float) $this->amount,
            'method' => $this->method instanceof \BackedEnum ? $this->method->value : $this->method,
            'date' => $this->date ? $this->date->format('Y-m-d') : null,
            'notes' => $this->notes,
            'created_by' => $this->created_by,
            'created_by_name' => $this->creator?->name,
            'created_by_role' => $this->creator?->role instanceof \BackedEnum ? $this->creator?->role->value : $this->creator?->role,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
