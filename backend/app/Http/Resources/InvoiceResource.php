<?php

namespace App\Http\Resources;

use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'invoice_number' => $this->invoice_number,
            'type' => $this->type instanceof \BackedEnum ? $this->type->value : $this->type,
            'date' => $this->date ? \Carbon\Carbon::parse($this->date)->format('Y-m-d') : null,
            'party_id' => $this->party_id,
            'party_name' => $this->party?->name,
            'subtotal' => Money::of($this->subtotal ?? 0)->getAmount(),
            'discount' => Money::of($this->discount ?? 0)->getAmount(),
            'shipping_amount' => Money::of($this->shipping_amount ?? 0)->getAmount(),
            'tax' => Money::of($this->tax ?? 0)->getAmount(),
            'total' => Money::of($this->total ?? 0)->getAmount(),
            'paid_amount' => Money::of($this->paid_amount ?? 0)->getAmount(),
            'due_amount' => Money::of($this->remaining_amount ?? 0)->getAmount(),
            'payment_method' => $this->payment_method instanceof \BackedEnum ? $this->payment_method->value : $this->payment_method,
            'parent_invoice_id' => $this->parent_invoice_id,
            'created_by' => $this->created_by,
            'created_by_name' => $this->creator?->name,
            'created_by_role' => $this->creator?->role instanceof \BackedEnum ? $this->creator?->role->value : $this->creator?->role,
            'salesperson_id' => $this->salesperson_id,
            'salesperson_name' => $this->salesperson?->name,
            'salesperson_role' => $this->salesperson?->role instanceof \BackedEnum ? $this->salesperson?->role->value : $this->salesperson?->role,
            'branch_id' => $this->branch_id,
            'shift_id' => $this->shift_id,
            'notes' => $this->notes,
            'items' => InvoiceItemResource::collection($this->whenLoaded('items')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
