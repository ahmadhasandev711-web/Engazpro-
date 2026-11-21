<?php

namespace App\Http\Requests\Auth;

use App\Support\PhoneNormalizer;
use App\Support\StoreCode;
use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
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
        if ($this->has('phone')) {
            $merged['phone'] = PhoneNormalizer::normalize((string) $this->input('phone'));
        }
        if ($this->has('password')) {
            $merged['password'] = trim((string) $this->input('password'));
        }
        if ($merged !== []) {
            $this->merge($merged);
        }
    }

    public function rules(): array
    {
        return [
            'store_code' => ['required', 'string', 'min:2', 'max:30', 'regex:' . StoreCode::PATTERN],
            'phone' => ['required', 'string'],
            'password' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'store_code.required' => 'معرّف المتجر مطلوب للدخول',
            'store_code.regex' => 'صيغة معرّف المتجر غير صحيحة',
            'phone.required' => 'رقم الهاتف مطلوب',
            'password.required' => 'كلمة المرور مطلوبة',
        ];
    }
}
