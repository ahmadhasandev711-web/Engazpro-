<?php

namespace App\Http\Resources;

use App\Enums\SubscriptionStatus;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SubscriptionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'status' => $this->status instanceof SubscriptionStatus ? $this->status->value : $this->status,
            'plan' => $this->plan,
            'price' => Money::of($this->price ?? 0)->getAmount(),
            'is_valid' => $this->isActive(),
            'days_remaining' => $this->days_remaining,
            'notes' => $this->notes,
        ];
    }
}
