<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PartyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', 'in:CUSTOMER,SUPPLIER,COURIER'],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'phone2' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'initial_balance' => ['nullable', 'numeric'],
        ];
    }

    public function messages(): array
    {
        return [
            'type.required' => 'نوع الطرف مطلوب (عميل أو مورد أو شركة شحن)',
            'type.in' => 'نوع الطرف غير صحيح',
            'name.required' => 'الاسم مطلوب',
        ];
    }
}
