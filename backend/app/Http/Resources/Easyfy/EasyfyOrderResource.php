<?php

namespace App\Http\Resources\Easyfy;

use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EasyfyOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isAdmin = (bool) $request->user()?->is_admin;

        return array_merge([
            'id' => $this->id,
            'order_number' => $this->order_number,
            'status' => $this->status?->value ?? $this->status,
            'status_label' => $this->status?->label(),
            'payment_method' => $this->payment_method?->value ?? $this->payment_method,
            'payment_method_label' => $this->payment_method?->label(),
            'payment_verification_status' => $this->payment_verification_status?->value ?? $this->payment_verification_status,
            'payment_verification_label' => $this->payment_verification_status?->label(),
            'transfer_reference' => $this->transfer_reference,
            'has_payment_proof' => !empty($this->payment_proof_path),
            'payment_rejection_reason' => $this->payment_rejection_reason,
            'verified_at' => $this->verified_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ], $this->identityAndShippingFields(), $this->amountFields($isAdmin), $this->relationFields($isAdmin));
    }

    private function identityAndShippingFields(): array
    {
        return [
            'account_id' => $this->account_id, 'store_code' => $this->store_code, 'store_name' => $this->store_name,
            'owner_name' => $this->owner_name, 'owner_phone' => $this->owner_phone,
            'ordered_by_user_id' => $this->ordered_by_user_id, 'ordered_by_name' => $this->ordered_by_name,
            'ordered_by_phone' => $this->ordered_by_phone, 'ordered_by_role' => $this->ordered_by_role,
            'recipient_name' => $this->recipient_name, 'recipient_phone' => $this->recipient_phone,
            'governorate' => $this->governorate, 'shipping_address' => $this->shipping_address,
            'customer_notes' => $this->customer_notes, 'courier_name' => $this->courier_name,
            'tracking_number' => $this->tracking_number, 'admin_notes' => $this->admin_notes,
        ];
    }

    private function amountFields(bool $isAdmin): array
    {
        return [
            'subtotal' => Money::of($this->subtotal ?? 0)->getAmount(),
            'discount_amount' => Money::of($this->discount_amount ?? 0)->getAmount(),
            'coupon_code' => $this->coupon_code,
            'shipping_fee' => Money::of($this->shipping_fee ?? 0)->getAmount(),
            'total_amount' => Money::of($this->total_amount ?? 0)->getAmount(),
            'total_cost' => $this->when($isAdmin, fn () => Money::of($this->total_cost ?? 0)->getAmount()),
            'gross_profit' => $this->when($isAdmin, fn () => Money::of($this->gross_profit ?? 0)->getAmount()),
        ];
    }

    private function relationFields(bool $isAdmin): array
    {
        return [
            'items' => $this->whenLoaded('items', fn () => $this->mapItems($isAdmin)),
            'status_histories' => $this->whenLoaded('statusHistories', fn () => $this->mapHistories()),
            'shipping_zone' => $this->whenLoaded('shippingZone', fn () => new EasyfyShippingZoneResource($this->shippingZone)),
            'verifier_name' => $this->whenLoaded('verifier', fn () => $this->verifier?->name),
        ];
    }

    private function mapItems(bool $isAdmin): array
    {
        return $this->items->map(fn ($item) => [
            'id' => $item->id, 'product_id' => $item->product_id, 'variant_id' => $item->variant_id,
            'product_name' => $item->product_name, 'variant_label' => $item->variant_label, 'sku' => $item->sku,
            'stock_mode' => $item->stock_mode?->value ?? $item->stock_mode, 'quantity' => (int) $item->quantity,
            'unit_price' => Money::of($item->unit_price ?? 0)->getAmount(),
            'line_total' => Money::of($item->line_total ?? 0)->getAmount(),
            'unit_cost' => $this->when($isAdmin, fn () => Money::of($item->unit_cost ?? 0)->getAmount()),
            'line_cost' => $this->when($isAdmin, fn () => Money::of($item->line_cost ?? 0)->getAmount()),
            'line_profit' => $this->when($isAdmin, fn () => Money::of($item->line_profit ?? 0)->getAmount()),
            'custom_note' => $item->custom_note, 'has_artwork' => !empty($item->artwork_path),
        ])->values()->all();
    }

    private function mapHistories(): array
    {
        return $this->statusHistories->map(fn ($h) => [
            'id' => $h->id,
            'from_status' => $h->from_status?->value ?? $h->from_status,
            'to_status' => $h->to_status?->value ?? $h->to_status,
            'to_status_label' => $h->to_status?->label(),
            'actor_name' => $h->actor_name,
            'note' => $h->note,
            'created_at' => $h->created_at?->toIso8601String(),
        ])->values()->all();
    }
}
