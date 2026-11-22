<?php

namespace App\Http\Resources\Easyfy;

use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EasyfyCouponResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'discount_type' => $this->discount_type?->value ?? $this->discount_type,
            'discount_type_label' => $this->discount_type?->label(),
            'discount_value' => Money::of($this->discount_value ?? 0)->getAmount(),
            'min_order_amount' => Money::of($this->min_order_amount ?? 0)->getAmount(),
            'max_discount_amount' => $this->max_discount_amount !== null ? Money::of($this->max_discount_amount)->getAmount() : null,
            'max_uses' => $this->max_uses,
            'max_uses_per_account' => $this->max_uses_per_account,
            'used_count' => (int) $this->used_count,
            'starts_at' => $this->starts_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'is_active' => (bool) $this->is_active,
        ];
    }
}
