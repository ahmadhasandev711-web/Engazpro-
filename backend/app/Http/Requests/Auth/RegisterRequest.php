<?php

namespace App\Http\Requests\Auth;

use App\Support\PhoneNormalizer;
use App\Support\StoreCode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merged = [];
        if ($this->has('phone')) {
            $merged['phone'] = PhoneNormalizer::canonical((string) $this->input('phone'));
        }
        if ($this->has('email')) {
            $merged['email'] = strtolower(trim((string) $this->input('email')));
        }
        if ($this->has('store_code')) {
            $merged['store_code'] = StoreCode::normalize((string) $this->input('store_code'));
        }
        if ($merged !== []) {
            $this->merge($merged);
        }
    }

    public function rules(): array
    {
        return [
            'store_code' => ['required', 'string', 'min:2', 'max:30', 'regex:' . StoreCode::PATTERN, 'unique:users,owned_store_code'],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:20'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:6'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            if (StoreCode::isReserved((string) $this->input('store_code'))) {
                $v->errors()->add('store_code', 'معرّف المتجر محجوز للنظام، يرجى اختيار معرّف آخر.');
            }
        });
    }

    public function messages(): array
    {
        return [
            'store_code.required' => 'معرّف المتجر مطلوب',
            'store_code.min' => 'معرّف المتجر لا يقل عن حرفين',
            'store_code.max' => 'معرّف المتجر لا يتجاوز 30 حرفاً',
            'store_code.regex' => 'معرّف المتجر يجب أن يكون أحرفاً إنجليزية صغيرة أو أرقاماً أو شرطة (-) بدون مسافات',
            'store_code.unique' => 'معرّف المتجر مستخدم بالفعل لمتجر آخر، يرجى اختيار معرّف مختلف',
            'name.required' => 'الاسم مطلوب',
            'phone.required' => 'رقم الهاتف مطلوب',
            'email.required' => 'البريد الإلكتروني مطلوب لاستعادة كلمة المرور',
            'email.email' => 'البريد الإلكتروني غير صالح',
            'password.required' => 'كلمة المرور مطلوبة',
            'password.min' => 'كلمة المرور لا تقل عن 6 أحرف',
        ];
    }
}
