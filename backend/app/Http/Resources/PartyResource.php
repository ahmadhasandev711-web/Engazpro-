<?php

namespace App\Http\Resources;

use App\Support\Money;
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
            'balance' => Money::of($this->balance ?? 0)->getAmount(),
            'store_credit_balance' => Money::of($this->store_credit_balance ?? 0)->getAmount(),
            'notes' => $this->notes,
            'crm_tier_override' => $this->crm_tier_override instanceof \BackedEnum ? $this->crm_tier_override->value : $this->crm_tier_override,
            'crm_metrics' => $this->resource->getAttribute('crm_metrics'),
            'invoices_count' => $this->whenCounted('invoices', $this->invoices_count),
            'interactions_count' => $this->whenCounted('interactions', $this->interactions_count),
            'has_transactions' => (bool) ($hasInvoices || $hasPayments || !Money::of($this->balance ?? 0)->isZero()),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
