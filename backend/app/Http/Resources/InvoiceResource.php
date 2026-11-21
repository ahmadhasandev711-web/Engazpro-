<?php

namespace App\Http\Resources;

use App\Enums\InvoiceReturnStatus;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'invoice_number' => $this->invoice_number,
            'type' => $this->enumValue($this->type),
            'date' => $this->date ? \Carbon\Carbon::parse($this->date)->format('Y-m-d') : null,
            'party_id' => $this->party_id,
            'party_name' => $this->party?->name,
            ...$this->amountFields(),
            'payment_method' => $this->enumValue($this->payment_method),
            'parent_invoice_id' => $this->parent_invoice_id,
            'exchange_id' => $this->exchange_id,
            'promotion_id' => $this->promotion_id,
            'coupon_code' => $this->coupon_code,
            ...$this->returnMetaFields(),
            'created_by' => $this->created_by,
            'created_by_name' => $this->creator?->name,
            'created_by_role' => $this->enumValue($this->creator?->role),
            'salesperson_id' => $this->salesperson_id,
            'salesperson_name' => $this->salesperson?->name,
            'salesperson_role' => $this->enumValue($this->salesperson?->role),
            ...$this->ecommerceOrderFields(),
            'branch_id' => $this->branch_id,
            'shift_id' => $this->shift_id,
            'notes' => $this->notes,
            'items' => InvoiceItemResource::collection($this->whenLoaded('items')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    private function ecommerceOrderFields(): array
    {
        return [
            'online_order_id' => $this->online_order_id,
            'wc_order_id' => $this->wc_order_id,
            'shopify_order_id' => $this->shopify_order_id,
            'is_ecommerce_order' => $this->resource->isEcommerceOrder(),
        ];
    }

    private function returnMetaFields(): array
    {
        $returnedMoney = Money::of($this->returned_total ?? 0);
        $totalMoney = Money::of($this->total ?? 0);
        $status = InvoiceReturnStatus::NONE->value;
        if ($returnedMoney->isPositive()) {
            $status = ($totalMoney->isPositive() && !$returnedMoney->lessThan($totalMoney))
                ? InvoiceReturnStatus::FULL->value
                : InvoiceReturnStatus::PARTIAL->value;
        }

        return [
            'parent_invoice_number' => $this->parentInvoice?->invoice_number,
            'returned_total' => $returnedMoney->getAmount(),
            'returns_count' => (int) ($this->returns_count ?? 0),
            'return_status' => $status,
        ];
    }

    private function amountFields(): array
    {
        return [
            'subtotal' => Money::of($this->subtotal ?? 0)->getAmount(),
            'discount' => Money::of($this->discount ?? 0)->getAmount(),
            'promotion_discount' => Money::of($this->promotion_discount ?? 0)->getAmount(),
            'shipping_amount' => Money::of($this->shipping_amount ?? 0)->getAmount(),
            'tax' => Money::of($this->tax ?? 0)->getAmount(),
            'total' => Money::of($this->total ?? 0)->getAmount(),
            'paid_amount' => Money::of($this->paid_amount ?? 0)->getAmount(),
            'due_amount' => Money::of($this->remaining_amount ?? 0)->getAmount(),
        ];
    }

    private function enumValue(mixed $value): mixed
    {
        return $value instanceof \BackedEnum ? $value->value : $value;
    }
}
