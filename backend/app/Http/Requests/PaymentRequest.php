<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $accountId = $this->user()?->getAccountId();

        return [
            'party_id' => [
                'required',
                $accountId ? Rule::exists('parties', 'id')->where('user_id', $accountId) : 'exists:parties,id',
            ],
            'idempotency_key' => ['nullable', 'string', 'max:100'],
            'type' => ['required', 'in:PAYMENT,RECEIPT'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'method' => ['nullable', 'string', 'in:CASH,CARD,TRANSFER'],
            'date' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'party_id.required' => 'يجب تحديد العميل أو المورد',
            'type.required' => 'نوع السند مطلوب (قبض أو صرف)',
            'amount.required' => 'مبلغ السند مطلوب',
            'amount.min' => 'يجب أن يكون المبلغ أكبر من الصفر',
            'date.required' => 'تاريخ السند مطلوب',
        ];
    }
}
