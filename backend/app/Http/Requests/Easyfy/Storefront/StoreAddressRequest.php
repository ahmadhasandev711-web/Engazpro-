<?php

namespace App\Http\Requests\Easyfy\Storefront;

use Illuminate\Foundation\Http\FormRequest;

class StoreAddressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'label' => ['required', 'string', 'max:100'],
            'recipient_name' => ['required', 'string', 'max:160'],
            'recipient_phone' => ['required', 'string', 'max:40'],
            'shipping_zone_id' => ['nullable', 'integer', 'exists:easyfy_shipping_zones,id'],
            'governorate' => ['required', 'string', 'max:100'],
            'address_line' => ['required', 'string', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:500'],
            'is_default' => ['nullable', 'boolean'],
        ];
    }
}
