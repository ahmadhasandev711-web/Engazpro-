<?php

namespace App\Http\Requests;

use App\Enums\ExchangeSettlementType;
use App\Enums\ReturnItemCondition;
use App\Http\Requests\Concerns\HasScopedValidation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class StoreOnlineExchangeRequest extends FormRequest
{
    use HasScopedValidation;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'returned_items' => ['required', 'array', 'min:1'],
            'returned_items.*.product_id' => ['required', $this->scopedExists('products')],
            'returned_items.*.product_variant_id' => ['nullable', 'integer'],
            'returned_items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'returned_items.*.condition' => ['nullable', 'string', new Enum(ReturnItemCondition::class)],
            'replacement_items' => ['required', 'array', 'min:1'],
            'replacement_items.*.product_id' => ['required', $this->scopedExists('products')],
            'replacement_items.*.product_variant_id' => ['nullable', 'integer'],
            'replacement_items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'replacement_items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'exchange_shipping_fee' => ['nullable', 'numeric', 'min:0'],
            'store_credit_used' => ['nullable', 'numeric', 'min:0'],
            'surplus_settlement' => ['nullable', 'string', new Enum(ExchangeSettlementType::class)],
            'refund_method' => ['nullable', 'string', 'in:CASH,INSTAPAY,VODAFONE_CASH,TRANSFER'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
