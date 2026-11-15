<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class ChangePasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string'],
            'new_password' => ['required', 'string', 'min:6', 'confirmed'],
        ];
    }

    public function messages(): array
    {
        return [
            'current_password.required' => 'يرجى إدخال كلمة المرور الحالية',
            'new_password.required' => 'يرجى إدخال كلمة المرور الجديدة',
            'new_password.min' => 'يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف',
            'new_password.confirmed' => 'تأكيد كلمة المرور الجديدة غير متطابق',
        ];
    }
}
