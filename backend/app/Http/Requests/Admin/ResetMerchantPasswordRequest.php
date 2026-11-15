<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ResetMerchantPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'password' => ['required', 'string', 'min:8', 'max:128'],
        ];
    }

    public function messages(): array
    {
        return [
            'password.required' => 'كلمة المرور الجديدة مطلوبة',
            'password.min' => 'كلمة المرور يجب ألا تقل عن 8 أحرف أو أرقام',
        ];
    }
}
