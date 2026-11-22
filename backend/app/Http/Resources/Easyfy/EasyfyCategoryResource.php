<?php

namespace App\Http\Resources\Easyfy;

use App\Services\Easyfy\EasyfyMediaService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EasyfyCategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'image_path' => EasyfyMediaService::toPublicUrl($this->image_path),
            'sort_order' => $this->sort_order,
            'is_active' => (bool) $this->is_active,
            'products_count' => $this->whenCounted('products'),
        ];
    }
}
