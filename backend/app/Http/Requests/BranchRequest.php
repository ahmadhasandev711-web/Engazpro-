<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BranchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isUpdate = $this->isMethod('PUT') || $this->isMethod('PATCH');

        return [
            'name' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50'],
            'type' => ['nullable', 'string', 'in:STORE,WAREHOUSE,VAN'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:500'],
            'is_main' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'اسم الفرع أو المخزن مطلوب.',
            'type.in' => 'نوع الفرع يجب أن يكون متجر (STORE) أو مخزن (WAREHOUSE) أو سيارة توزيع (VAN).',
        ];
    }
}
