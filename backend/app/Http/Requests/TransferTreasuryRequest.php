<?php

namespace App\Http\Requests;

use App\Models\Treasury;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class TransferTreasuryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('transfer', Treasury::class);
    }

    public function rules(): array
    {
        return [
            'from_treasury_id' => ['required', 'integer', 'different:to_treasury_id'],
            'to_treasury_id' => ['required', 'integer'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'from_treasury_id.required' => 'يجب تحديد خزينة المصدر',
            'to_treasury_id.required' => 'يجب تحديد خزينة الوجهة',
            'from_treasury_id.different' => 'لا يمكن التحويل لنفس الخزينة',
            'amount.min' => 'المبلغ يجب أن يكون أكبر من صفر',
        ];
    }
}
