<?php

namespace App\Http\Requests;

use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Foundation\Http\FormRequest;

class ProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'category_id' => ($this->category_id === '' || $this->category_id === 0 || $this->category_id === '0') ? null : $this->category_id,
            'purchase_price' => Money::of($this->purchase_price ?? 0)->getAmount(),
            'sale_price' => Money::of($this->sale_price ?? 0)->getAmount(),
            'quantity' => Quantity::of($this->quantity ?? 0)->toFloat(),
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'in:STANDARD,VARIABLE,EXPIRY'],
            'has_expiry' => ['nullable', 'boolean'],
            'has_variants' => ['nullable', 'boolean'],
            'code' => ['nullable', 'string', 'max:100'],
            'barcode' => ['nullable', 'string', 'max:100', 'regex:/^[ -~]+$/', 'not_regex:/[<>"\'`]/'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'unit' => ['nullable', 'string', 'max:50'],
            'sub_unit' => ['nullable', 'string', 'max:50'],
            'sub_unit_factor' => ['nullable', 'numeric', 'min:0.01'],
            'sub_unit_price' => ['nullable', 'numeric', 'min:0'],
            'purchase_price' => ['required', 'numeric', 'min:0'],
            'regular_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['required', 'numeric', 'min:0'],
            'min_sale_price' => ['nullable', 'numeric', 'min:0'],
            'quantity' => ['nullable', 'numeric', 'min:0'],
            'min_quantity' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            ...$this->variantRules(),
            ...$this->batchRules(),
        ];
    }

    private function variantRules(): array
    {
        return [
            'variants' => ['nullable', 'array'],
            'variants.*.id' => ['nullable', 'integer'],
            'variants.*.name' => ['required_with:variants', 'string', 'max:255'],
            'variants.*.color' => ['nullable', 'string', 'max:100'],
            'variants.*.size' => ['nullable', 'string', 'max:100'],
            'variants.*.barcode' => ['nullable', 'string', 'max:100', 'regex:/^[ -~]+$/', 'not_regex:/[<>"\'`]/'],
            'variants.*.code' => ['nullable', 'string', 'max:100'],
            'variants.*.purchase_price' => ['nullable', 'numeric', 'min:0'],
            'variants.*.regular_price' => ['nullable', 'numeric', 'min:0'],
            'variants.*.sale_price' => ['nullable', 'numeric', 'min:0'],
            'variants.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'variants.*.min_quantity' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    private function batchRules(): array
    {
        return [
            'batches' => ['nullable', 'array'],
            'batches.*.id' => ['nullable', 'integer'],
            'batches.*.batch_number' => ['required_with:batches', 'string', 'max:100'],
            'batches.*.expiry_date' => ['required_with:batches', 'date'],
            'batches.*.production_date' => ['nullable', 'date'],
            'batches.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'batches.*.purchase_price' => ['nullable', 'numeric', 'min:0'],
            'batches.*.sale_price' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'اسم الصنف مطلوب',
            'purchase_price.required' => 'سعر الشراء مطلوب',
            'purchase_price.min' => 'سعر الشراء لا يمكن أن يكون سالباً',
            'sale_price.required' => 'سعر البيع مطلوب',
            'sale_price.min' => 'سعر البيع لا يمكن أن يكون سالباً',
            'quantity.min' => 'الكمية لا يمكن أن تكون سالبة',
            'barcode.regex' => 'الباركود يجب أن يحتوي على حروف وأرقام إنجليزية فقط',
            'barcode.not_regex' => 'الباركود يحتوي على رموز غير مسموحة',
            'variants.*.barcode.regex' => 'باركود المتغير يجب أن يحتوي على حروف وأرقام إنجليزية فقط',
            'variants.*.barcode.not_regex' => 'باركود المتغير يحتوي على رموز غير مسموحة',
        ];
    }
}
