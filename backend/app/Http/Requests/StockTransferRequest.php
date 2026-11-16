<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\HasScopedValidation;
use Illuminate\Foundation\Http\FormRequest;

class StockTransferRequest extends FormRequest
{
    use HasScopedValidation;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'from_branch_id' => ['required', 'integer', $this->scopedExists('branches')],
            'to_branch_id' => ['required', 'integer', 'different:from_branch_id', $this->scopedExists('branches')],
            'transfer_number' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', $this->scopedExists('products')],
            'items.*.product_variant_id' => ['nullable', 'integer', $this->scopedExists('product_variants')],
            'items.*.quantity_sent' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_name' => ['nullable', 'string', 'max:50'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'from_branch_id.required' => 'يرجى تحديد فرع المصدر.',
            'to_branch_id.required' => 'يرجى تحديد فرع الوجهة.',
            'to_branch_id.different' => 'لا يمكن إجراء تحويل لنفس الفرع.',
            'items.required' => 'يجب إضافة صنف واحد على الأقل للتحويل.',
            'items.*.quantity_sent.gt' => 'كمية التحويل يجب أن تكون أكبر من صفر.',
        ];
    }
}
