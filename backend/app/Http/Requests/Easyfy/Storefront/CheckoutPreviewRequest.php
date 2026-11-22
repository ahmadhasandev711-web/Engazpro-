<?php

namespace App\Http\Requests\Easyfy\Storefront;

use Illuminate\Foundation\Http\FormRequest;

class CheckoutPreviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'shipping_zone_id' => ['nullable', 'integer', 'exists:easyfy_shipping_zones,id'],
            'coupon_code' => ['nullable', 'string', 'max:64'],
        ];
    }
}
