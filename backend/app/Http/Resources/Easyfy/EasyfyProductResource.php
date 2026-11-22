<?php

namespace App\Http\Resources\Easyfy;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EasyfyProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'category' => $this->whenLoaded('category', fn () => new EasyfyCategoryResource($this->category)),
            'name' => $this->name,
            'slug' => $this->slug,
            'short_description' => $this->short_description,
            'description' => $this->description,
            'stock_mode' => $this->stock_mode?->value ?? $this->stock_mode,
            'stock_mode_label' => $this->stock_mode?->label(),
            'lead_time_days' => $this->lead_time_days,
            'min_order_qty' => (int) $this->min_order_qty,
            'allow_custom_note' => (bool) $this->allow_custom_note,
            'custom_note_label' => $this->custom_note_label,
            'allow_artwork_upload' => (bool) $this->allow_artwork_upload,
            'is_active' => (bool) $this->is_active,
            'is_featured' => (bool) $this->is_featured,
            'images' => $this->whenLoaded('images', fn () => $this->mapImages()),
            'variants' => EasyfyVariantResource::collection($this->whenLoaded('variants')),
        ];
    }

    private function mapImages(): array
    {
        return $this->images->map(fn ($img) => [
            'id' => $img->id,
            'image_path' => $img->image_path,
            'variant_id' => $img->variant_id,
            'is_primary' => (bool) $img->is_primary,
            'sort_order' => (int) $img->sort_order,
        ])->values()->all();
    }
}
