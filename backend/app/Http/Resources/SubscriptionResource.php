<?php

namespace App\Http\Resources;

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
            'status' => $this->status,
            'plan' => $this->plan,
            'price' => (float) $this->price,
            'is_valid' => $this->isActive(),
            'days_remaining' => $this->days_remaining,
            'notes' => $this->notes,
        ];
    }
}
