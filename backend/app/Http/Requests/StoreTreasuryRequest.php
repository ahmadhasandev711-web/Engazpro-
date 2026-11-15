<?php

namespace App\Http\Requests;

use App\Enums\TreasuryType;
use App\Models\Treasury;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class StoreTreasuryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('create', Treasury::class);
    }

    public function rules(): array
    {
        $accountId = $this->user()->getAccountId();
        $types = array_column(TreasuryType::cases(), 'value');

        return [
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', 'string', Rule::in($types)],
            'branch_id' => [
                'nullable',
                'integer',
                Rule::exists('branches', 'id')->where('user_id', $accountId),
            ],
            'opening_balance' => ['nullable', 'numeric', 'min:0'],
            'assigned_user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(function ($q) use ($accountId) {
                    $q->where('id', $accountId)->orWhere('owner_id', $accountId);
                }),
            ],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'يجب إدخال اسم الخزينة أو الحساب',
            'type.required' => 'يجب تحديد نوع الخزينة',
            'type.in' => 'نوع الخزينة المحدد غير صالح',
        ];
    }
}
