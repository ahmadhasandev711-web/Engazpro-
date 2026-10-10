<?php

namespace App\Http\Requests;

use App\Enums\EmployeeAdjustmentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class PayrollAdjustmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', new Enum(EmployeeAdjustmentType::class)],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'date' => ['required', 'date'],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'type.required' => 'نوع التسوية (مكافأة أو خصم أو سلفة) مطلوب.',
            'amount.required' => 'مبلغ التسوية مطلوب.',
            'amount.min' => 'يجب أن يكون المبلغ أكبر من الصفر.',
            'date.required' => 'تاريخ التسوية مطلوب.',
        ];
    }
}
