<?php

namespace App\Http\Resources;

use App\Enums\PromotionSyncSource;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PromotionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'type' => $this->type instanceof \BackedEnum ? $this->type->value : $this->type,
            'discount_type' => $this->discount_type instanceof \BackedEnum ? $this->discount_type->value : $this->discount_type,
            'discount_value' => Money::of($this->discount_value ?? 0)->getAmount(),
            'buy_quantity' => $this->buy_quantity,
            'get_quantity' => $this->get_quantity,
            'branch_id' => $this->branch_id,
            'branch_name' => $this->branch?->name,
            'category_id' => $this->category_id,
            'category_name' => $this->category?->name,
            'product_id' => $this->product_id,
            'product_name' => $this->product?->name,
            ...$this->limitsAndSchedule(),
            'is_active' => (bool) $this->is_active,
            'wc_coupon_id' => $this->wc_coupon_id,
            'shopify_discount_id' => $this->shopify_discount_id,
            'sync_source' => $this->sync_source instanceof \BackedEnum ? $this->sync_source->value : ($this->sync_source ?? PromotionSyncSource::LOCAL->value),
            'sync_to_ecommerce' => (bool) ($this->sync_to_ecommerce ?? true),
            'last_synced_at' => $this->last_synced_at?->toIso8601String(),
            'sync_error' => $this->sync_error,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    private function limitsAndSchedule(): array
    {
        return [
            'min_order_amount' => Money::of($this->min_order_amount ?? 0)->getAmount(),
            'max_discount_amount' => $this->max_discount_amount !== null ? Money::of($this->max_discount_amount)->getAmount() : null,
            'max_uses' => $this->max_uses,
            'used_count' => (int) ($this->used_count ?? 0),
            'starts_at' => $this->starts_at?->format('Y-m-d'),
            'ends_at' => $this->ends_at?->format('Y-m-d'),
        ];
    }
}
