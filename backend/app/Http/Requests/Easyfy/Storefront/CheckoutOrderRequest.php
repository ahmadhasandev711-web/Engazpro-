<?php

namespace App\Http\Requests\Easyfy\Storefront;

use App\Enums\Easyfy\EasyfyPaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class CheckoutOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'recipient_name' => ['required', 'string', 'max:160'],
            'recipient_phone' => ['required', 'string', 'max:40'],
            'shipping_zone_id' => ['nullable', 'integer', 'exists:easyfy_shipping_zones,id'],
            'governorate' => ['required', 'string', 'max:100'],
            'shipping_address' => ['required', 'string', 'max:1000'],
            'customer_notes' => ['nullable', 'string', 'max:1000'],
            'coupon_code' => ['nullable', 'string', 'max:64'],
            'payment_method' => ['required', 'string', new Enum(EasyfyPaymentMethod::class)],
            'transfer_reference' => ['nullable', 'string', 'max:120'],
            'payment_proof' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'idempotency_key' => ['nullable', 'string', 'max:100'],
        ];
    }
}
