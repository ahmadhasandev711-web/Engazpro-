<?php

namespace App\Http\Requests\Auth;

use App\Support\PhoneNormalizer;
use App\Support\StoreCode;
use Illuminate\Foundation\Http\FormRequest;

class ResetPasswordOtpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merged = [];
        if ($this->has('store_code')) {
            $merged['store_code'] = StoreCode::normalize((string) $this->input('store_code'));
        }
        foreach (['phone', 'otp'] as $field) {
            if ($this->has($field)) {
                $merged[$field] = PhoneNormalizer::normalize((string) $this->input($field));
            }
        }
        if ($merged !== []) {
            $this->merge($merged);
        }
    }

    public function rules(): array
    {
        return [
            'store_code' => ['required', 'string', 'min:2', 'max:30', 'regex:' . StoreCode::PATTERN],
            'phone' => ['required', 'string', 'min:8', 'max:20'],
            'otp' => ['required', 'string', 'size:6'],
            'password' => ['required', 'string', 'min:6', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'store_code.required' => 'معرّف المتجر مطلوب',
            'store_code.regex' => 'صيغة معرّف المتجر غير صحيحة',
            'phone.required' => 'رقم الهاتف مطلوب',
            'otp.required' => 'رمز التحقق مطلوب',
            'otp.size' => 'رمز التحقق يجب أن يتكون من 6 أرقام',
            'password.required' => 'كلمة المرور الجديدة مطلوبة',
            'password.min' => 'كلمة المرور لا تقل عن 6 أحرف',
        ];
    }
}
