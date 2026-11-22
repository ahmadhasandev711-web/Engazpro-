<?php

namespace App\Http\Requests\Easyfy\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateEasyfyOrderCostsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.order_item_id' => ['required', 'integer', 'exists:easyfy_order_items,id'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
        ];
    }
}
