<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExpenseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'category' => $this->category,
            'amount' => (float) $this->amount,
            'payment_method' => $this->payment_method instanceof \App\Enums\PaymentMethod ? $this->payment_method->value : ($this->payment_method ?? 'CASH'),
            'treasury_id' => $this->treasury_id,
            'treasury_name' => $this->treasury?->name,
            'creator_name' => $this->creator?->name,
            'date' => $this->date ? $this->date->format('Y-m-d') : null,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
