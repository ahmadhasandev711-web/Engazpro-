<?php

namespace App\Http\Requests;

use App\Enums\PromotionDiscountType;
use App\Enums\PromotionType;
use App\Http\Requests\Concerns\HasScopedValidation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PromotionRequest extends FormRequest
{
    use HasScopedValidation;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'branch_id' => $this->nullIfEmpty($this->branch_id),
            'category_id' => $this->nullIfEmpty($this->category_id),
            'product_id' => $this->nullIfEmpty($this->product_id),
            'buy_quantity' => $this->nullIfEmpty($this->buy_quantity),
            'get_quantity' => $this->nullIfEmpty($this->get_quantity),
            'max_discount_amount' => $this->nullIfEmpty($this->max_discount_amount),
            'max_uses' => $this->nullIfEmpty($this->max_uses),
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:64', Rule::requiredIf($this->input('type') === PromotionType::COUPON->value)],
            'type' => ['required', Rule::enum(PromotionType::class)],
            'discount_type' => ['required', Rule::enum(PromotionDiscountType::class)],
            'discount_value' => ['required', 'numeric', 'min:0'],
            'buy_quantity' => ['nullable', 'integer', 'min:1'],
            'get_quantity' => ['nullable', 'integer', 'min:1'],
            'branch_id' => ['nullable', $this->scopedExists('branches')],
            'category_id' => ['nullable', $this->scopedExists('categories')],
            'product_id' => ['nullable', $this->scopedExists('products')],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'max_discount_amount' => ['nullable', 'numeric', 'min:0'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['nullable', 'boolean'],
            'sync_to_ecommerce' => ['nullable', 'boolean'],
        ];
    }

    private function nullIfEmpty(mixed $val): mixed
    {
        return ($val === '' || $val === '0' || $val === 0) ? null : $val;
    }
}
