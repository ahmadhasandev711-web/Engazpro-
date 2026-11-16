<?php

namespace App\Http\Requests;

use App\Enums\PaymentMethod;
use App\Http\Requests\Concerns\HasScopedValidation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class DisbursePayrollRequest extends FormRequest
{
    use HasScopedValidation;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'month' => ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'treasury_id' => ['required', 'integer', $this->scopedExists('treasuries')],
            'payment_method' => ['required', new Enum(PaymentMethod::class)],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'month.required' => 'الشهر المستحق مطلوب (YYYY-MM).',
            'month.regex' => 'صيغة الشهر غير صالحة، يجب أن تكون (YYYY-MM).',
            'treasury_id.required' => 'يجب تحديد الخزينة أو الحساب البنكي المراد الخصم منه.',
            'treasury_id.exists' => 'الخزينة المحددة غير صالحة.',
            'payment_method.required' => 'طريقة الدفع (كاش، بنك، انستاباي...) مطلوبة.',
        ];
    }
}
