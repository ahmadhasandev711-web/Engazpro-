<?php

namespace App\Http\Resources\Easyfy;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EasyfyAddressResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'label' => $this->label,
            'recipient_name' => $this->recipient_name,
            'recipient_phone' => $this->recipient_phone,
            'shipping_zone_id' => $this->shipping_zone_id,
            'shipping_zone' => $this->whenLoaded('shippingZone', fn () => new EasyfyShippingZoneResource($this->shippingZone)),
            'governorate' => $this->governorate,
            'address_line' => $this->address_line,
            'notes' => $this->notes,
            'is_default' => (bool) $this->is_default,
        ];
    }
}
