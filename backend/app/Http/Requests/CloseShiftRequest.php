<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CloseShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'actual_cash' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'actual_cash.required' => 'يرجى إدخال المبلغ الفعلي الموجود في الدرج / العهدة',
            'actual_cash.min' => 'المبلغ الفعلي لا يمكن أن يكون سالباً',
        ];
    }
}
