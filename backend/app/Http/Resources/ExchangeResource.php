<?php

namespace App\Http\Resources;

use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExchangeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return array_merge([
            'id' => $this->id,
            'exchange_number' => $this->exchange_number,
            'source' => $this->enumVal($this->source),
            'status' => $this->enumVal($this->status),
            'branch_id' => $this->branch_id,
            'branch_name' => $this->whenLoaded('branch', fn () => $this->branch?->name),
            'party_id' => $this->party_id,
            'party_name' => $this->whenLoaded('party', fn () => $this->party?->name),
            'party_phone' => $this->whenLoaded('party', fn () => $this->party?->phone),
            'salesperson_id' => $this->salesperson_id,
            'salesperson_name' => $this->whenLoaded('salesperson', fn () => $this->salesperson?->name),
            'created_by' => $this->created_by,
            'created_by_name' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'notes' => $this->notes,
            'items' => $this->whenLoaded('items', fn () => $this->mapItems()),
        ], $this->referenceFields(), $this->amountFields());
    }

    private function referenceFields(): array
    {
        return [
            'original_invoice_id' => $this->original_invoice_id,
            'original_invoice_number' => $this->whenLoaded('originalInvoice', fn () => $this->originalInvoice?->invoice_number),
            'original_online_order_id' => $this->original_online_order_id,
            'original_online_order_number' => $this->whenLoaded('originalOnlineOrder', fn () => $this->originalOnlineOrder?->external_order_number),
            'return_invoice_id' => $this->return_invoice_id,
            'return_invoice_number' => $this->whenLoaded('returnInvoice', fn () => $this->returnInvoice?->invoice_number),
            'replacement_invoice_id' => $this->replacement_invoice_id,
            'replacement_invoice_number' => $this->whenLoaded('replacementInvoice', fn () => $this->replacementInvoice?->invoice_number),
            'replacement_online_order_id' => $this->replacement_online_order_id,
            'replacement_online_order_number' => $this->whenLoaded('replacementOnlineOrder', fn () => $this->replacementOnlineOrder?->external_order_number),
        ];
    }

    private function amountFields(): array
    {
        return [
            'return_total' => Money::of($this->return_total ?? 0)->getAmount(),
            'replacement_total' => Money::of($this->replacement_total ?? 0)->getAmount(),
            'exchange_shipping_fee' => Money::of($this->exchange_shipping_fee ?? 0)->getAmount(),
            'store_credit_used' => Money::of($this->store_credit_used ?? 0)->getAmount(),
            'net_amount' => Money::of($this->net_amount ?? 0)->getAmount(),
            'settlement_type' => $this->enumVal($this->settlement_type),
            'payment_method' => $this->enumVal($this->payment_method),
        ];
    }

    private function mapItems()
    {
        return $this->items->map(fn ($item) => [
            'id' => $item->id,
            'direction' => $this->enumVal($item->direction),
            'product_id' => $item->product_id,
            'product_variant_id' => $item->product_variant_id,
            'product_name' => $item->product_name,
            'variant_name' => $item->variant_name,
            'quantity' => Quantity::of($item->quantity)->toFloat(),
            'unit_price' => Money::of($item->unit_price ?? 0)->getAmount(),
            'total' => Money::of($item->total ?? 0)->getAmount(),
            'condition' => $this->enumVal($item->condition),
            'received_into_stock_at' => $item->received_into_stock_at?->toIso8601String(),
        ])->values();
    }

    private function enumVal(mixed $val): mixed
    {
        return $val instanceof \BackedEnum ? $val->value : $val;
    }
}
