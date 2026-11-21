<?php

namespace App\Http\Requests\Admin;

use App\Support\PhoneNormalizer;
use App\Support\StoreCode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateMerchantProfileRequest extends FormRequest
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
        if ($this->filled('email')) {
            $merged['email'] = strtolower(trim((string) $this->input('email')));
        }
        if ($this->filled('store_code')) {
            $merged['store_code'] = StoreCode::normalize((string) $this->input('store_code'));
        }
        if ($merged !== []) {
            $this->merge($merged);
        }
    }

    public function rules(): array
    {
        $targetUser = $this->route('user');
        $targetId = is_object($targetUser) ? $targetUser->id : $targetUser;
        $targetStoreCode = $this->filled('store_code')
            ? StoreCode::normalize((string) $this->input('store_code'))
            : (is_object($targetUser) ? (string) $targetUser->store_code : '');

        $phoneRule = Rule::unique('users', 'phone')->ignore($targetId);
        $emailRule = Rule::unique('users', 'email')->ignore($targetId);
        if ($targetStoreCode !== '') {
            $phoneRule->where(fn ($q) => $q->where('store_code', $targetStoreCode));
            $emailRule->where(fn ($q) => $q->where('store_code', $targetStoreCode));
        }

        return [
            'store_code' => ['nullable', 'string', 'min:2', 'max:30', 'regex:' . StoreCode::PATTERN, Rule::unique('users', 'owned_store_code')->ignore($targetId)],
            'name' => ['required', 'string', 'max:255'],
            'business_name' => ['nullable', 'string', 'max:255'],
            'phone' => ['required', 'string', 'min:8', 'max:20', $phoneRule],
            'email' => ['nullable', 'email', 'max:255', $emailRule],
            'plan' => ['nullable', 'string', Rule::in(['TRIAL', 'BASIC', 'PRO_ECOMMERCE', 'ANNUAL'])],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            if ($this->filled('store_code') && StoreCode::isReserved((string) $this->input('store_code'))) {
                $v->errors()->add('store_code', 'معرّف المتجر محجوز للنظام، يرجى اختيار معرّف آخر.');
            }
        });
    }

    public function messages(): array
    {
        return [
            'store_code.regex' => 'معرّف المتجر يجب أن يكون أحرفاً إنجليزية صغيرة أو أرقاماً أو شرطة (-)',
            'store_code.unique' => 'معرّف المتجر مستخدم لمتجر آخر',
            'name.required' => 'اسم صاحب المتجر مطلوب',
            'phone.required' => 'رقم الهاتف مطلوب',
            'phone.unique' => 'رقم الهاتف مستخدم في حساب آخر بنفس المتجر',
            'email.email' => 'صيغة البريد الإلكتروني غير صحيحة',
            'email.unique' => 'البريد الإلكتروني مستخدم في حساب آخر بنفس المتجر',
        ];
    }
}
