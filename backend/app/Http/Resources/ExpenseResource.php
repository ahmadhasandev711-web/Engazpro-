<?php

namespace App\Http\Resources;

use App\Enums\PaymentMethod;
use App\Support\Money;
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
            'amount' => Money::of($this->amount ?? 0)->getAmount(),
            'payment_method' => $this->payment_method instanceof PaymentMethod ? $this->payment_method->value : ($this->payment_method ?? PaymentMethod::CASH->value),
            'treasury_id' => $this->treasury_id,
            'treasury_name' => $this->treasury?->name,
            'creator_name' => $this->creator?->name,
            'date' => $this->date ? $this->date->format('Y-m-d') : null,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
