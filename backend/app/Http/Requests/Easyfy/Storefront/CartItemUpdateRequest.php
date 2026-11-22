<?php

namespace App\Http\Requests\Easyfy\Storefront;

use Illuminate\Foundation\Http\FormRequest;

class CartItemUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'quantity' => ['required', 'integer', 'min:0', 'max:100000'],
            'custom_note' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
