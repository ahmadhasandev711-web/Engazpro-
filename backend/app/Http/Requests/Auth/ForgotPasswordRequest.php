<?php

namespace App\Http\Requests\Auth;

use App\Support\PhoneNormalizer;
use App\Support\StoreCode;
use Illuminate\Foundation\Http\FormRequest;

class ForgotPasswordRequest extends FormRequest
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
        if ($merged !== []) {
            $this->merge($merged);
        }
    }

    public function rules(): array
    {
        return [
            'store_code' => ['required', 'string', 'min:2', 'max:30', 'regex:' . StoreCode::PATTERN],
            'phone' => ['required', 'string', 'min:8', 'max:20'],
            'notes' => ['nullable', 'string', 'max:300'],
        ];
    }

    public function messages(): array
    {
        return [
            'store_code.required' => 'معرّف المتجر مطلوب',
            'store_code.regex' => 'صيغة معرّف المتجر غير صحيحة',
            'phone.required' => 'يرجى إدخال رقم الهاتف المسجل',
            'phone.min' => 'رقم الهاتف غير صالح',
        ];
    }
}
