<?php

namespace App\Http\Resources\Easyfy;

use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EasyfyShippingZoneResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'governorate_name' => $this->governorate_name,
            'shipping_fee' => Money::of($this->shipping_fee ?? 0)->getAmount(),
            'free_shipping_threshold' => $this->free_shipping_threshold !== null ? Money::of($this->free_shipping_threshold)->getAmount() : null,
            'estimated_days' => $this->estimated_days,
            'is_active' => (bool) $this->is_active,
            'sort_order' => (int) $this->sort_order,
        ];
    }
}
