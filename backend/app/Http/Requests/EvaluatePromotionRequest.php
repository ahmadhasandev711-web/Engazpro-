<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\HasScopedValidation;
use Illuminate\Foundation\Http\FormRequest;

class EvaluatePromotionRequest extends FormRequest
{
    use HasScopedValidation;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'branch_id' => ['nullable', $this->scopedExists('branches')],
            'coupon_code' => ['nullable', 'string', 'max:64'],
            'items' => ['required', 'array'],
            'items.*.product_id' => ['required', $this->scopedExists('products')],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ];
    }
}
