<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        if ($this->is('*/close')) {
            return [
                'actual_cash' => ['required', 'numeric', 'min:0'],
                'notes' => ['nullable', 'string', 'max:1000'],
            ];
        }

        return [
            'opening_balance' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'actual_cash.required' => 'يرجى إدخال المبلغ الفعلي الموجود في الدرج / العهدة.',
            'actual_cash.min' => 'المبلغ الفعلي لا يمكن أن يكون سالباً.',
            'opening_balance.min' => 'الرصيد الافتتاحي لا يمكن أن يكون سالباً.',
        ];
    }
}
