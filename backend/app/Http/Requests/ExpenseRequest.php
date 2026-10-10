<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'payment_method' => $this->payment_method ?: 'CASH',
            'amount' => (float) ($this->amount ?? 0),
        ]);
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:100'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['nullable', 'string', new \Illuminate\Validation\Rules\Enum(\App\Enums\PaymentMethod::class)],
            'treasury_id' => ['nullable', 'exists:treasuries,id'],
            'date' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $user = $this->user();
            $method = $this->input('payment_method');

            if ($user && ($user->isCashier() || $user->isMandob())) {
                $allowed = ['CASH', 'VODAFONE_CASH', 'INSTAPAY'];
                if ($method && !in_array($method, $allowed, true)) {
                    $validator->errors()->add(
                        'payment_method',
                        'عذراً، غير مسموح لك بالصرف من الحسابات البنكية أو الخزينة العامة. القنوات المتاحة لك هي: النقدية (الدرج)، فودافون كاش، وإنستاباي.'
                    );
                }
            }
        });
    }

    public function messages(): array
    {
        return [
            'title.required' => 'عنوان/جهة المصروف مطلوب',
            'amount.required' => 'المبلغ مطلوب',
            'amount.min' => 'يجب أن يكون المبلغ أكبر من الصفر',
            'date.required' => 'تاريخ المصروف مطلوب',
            'payment_method.enum' => 'طريقة الدفع المختارة غير صالحة',
            'treasury_id.exists' => 'الخزينة المحددة غير موجودة',
        ];
    }
}
