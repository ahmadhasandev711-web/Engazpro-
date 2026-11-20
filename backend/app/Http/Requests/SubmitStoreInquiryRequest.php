<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SubmitStoreInquiryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:150', 'not_regex:/https?:\/\//i'],
            'phone' => ['required', 'string', 'max:30', 'regex:/^[0-9+\-\s()]{7,20}$/'],
            'business_type' => ['nullable', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'company_ref' => ['nullable', 'string', 'max:200'],
            'elapsed_ms' => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.not_regex' => 'الاسم يجب أن يكون نصاً بدون روابط.',
            'phone.regex' => 'يرجى إدخال رقم موبايل صحيح (أرقام فقط بين 7 و20 خانة).',
        ];
    }
}
