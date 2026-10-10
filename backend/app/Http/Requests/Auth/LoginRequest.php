<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('phone')) {
            $phone = trim((string) $this->input('phone'));
            $eastern = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
            $western = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
            $phone = str_replace($eastern, $western, $phone);
            $this->merge(['phone' => $phone]);
        }

        if ($this->has('password')) {
            $this->merge(['password' => trim((string) $this->input('password'))]);
        }
    }

    public function rules(): array
    {
        return [
            'phone' => ['required', 'string'],
            'password' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'phone.required' => 'رقم الهاتف مطلوب',
            'password.required' => 'كلمة المرور مطلوبة',
        ];
    }
}
