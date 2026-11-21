<?php

namespace App\Http\Requests;

use App\Enums\ExchangeSettlementType;
use App\Enums\ReturnItemCondition;
use App\Http\Requests\Concerns\HasScopedValidation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class StoreExchangeRequest extends FormRequest
{
    use HasScopedValidation;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return array_merge([
            'original_invoice_id' => ['nullable', $this->scopedExists('invoices')],
            'branch_id' => ['nullable', $this->scopedExists('branches')],
            'party_id' => ['nullable', $this->scopedExists('parties')],
            'replacement_salesperson_id' => ['nullable', $this->scopedAccountUserExists()],
            'exchange_shipping_fee' => ['nullable', 'numeric', 'min:0'],
            'store_credit_used' => ['nullable', 'numeric', 'min:0'],
            'surplus_settlement' => ['nullable', 'string', new Enum(ExchangeSettlementType::class)],
            'payment_method' => ['nullable', 'string', 'in:CASH,CARD,INSTAPAY,VODAFONE_CASH,TRANSFER,CREDIT,STORE_CREDIT'],
            'refund_method' => ['nullable', 'string', 'in:CASH,CARD,INSTAPAY,VODAFONE_CASH,TRANSFER'],
            'store_credit_expires_at' => ['nullable', 'date'],
            'date' => ['nullable', 'date'],
            'idempotency_key' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], $this->returnedItemRules(), $this->replacementItemRules());
    }

    private function returnedItemRules(): array
    {
        return [
            'returned_items' => ['required', 'array', 'min:1'],
            'returned_items.*.product_id' => ['required', $this->scopedExists('products')],
            'returned_items.*.product_variant_id' => ['nullable', 'integer'],
            'returned_items.*.product_batch_id' => ['nullable', 'integer'],
            'returned_items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'returned_items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'returned_items.*.condition' => ['nullable', 'string', new Enum(ReturnItemCondition::class)],
        ];
    }

    private function replacementItemRules(): array
    {
        return [
            'replacement_items' => ['nullable', 'array'],
            'replacement_items.*.product_id' => ['required', $this->scopedExists('products')],
            'replacement_items.*.product_variant_id' => ['nullable', 'integer'],
            'replacement_items.*.product_batch_id' => ['nullable', 'integer'],
            'replacement_items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'replacement_items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
