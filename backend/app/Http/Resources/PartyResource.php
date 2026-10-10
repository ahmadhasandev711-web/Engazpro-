<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PartyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $hasInvoices = isset($this->invoices_exists)
            ? (bool) $this->invoices_exists
            : ($this->relationLoaded('invoices') ? $this->invoices->isNotEmpty() : $this->invoices()->exists());

        $hasPayments = isset($this->payments_exists)
            ? (bool) $this->payments_exists
            : ($this->relationLoaded('payments') ? $this->payments->isNotEmpty() : $this->payments()->exists());

        return [
            'id' => $this->id,
            'type' => $this->type,
            'name' => $this->name,
            'phone' => $this->phone,
            'phone2' => $this->phone2,
            'address' => $this->address,
            'balance' => (float) $this->balance,
            'notes' => $this->notes,
            'invoices_count' => $this->whenCounted('invoices', $this->invoices_count),
            'has_transactions' => (bool) ($hasInvoices || $hasPayments || ((float) $this->balance !== 0.0)),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
