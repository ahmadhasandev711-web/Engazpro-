<?php

namespace App\Http\Requests\Easyfy\Storefront;

use Illuminate\Foundation\Http\FormRequest;

class CartItemStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'variant_id' => ['required', 'integer', 'exists:easyfy_product_variants,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:100000'],
            'custom_note' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
