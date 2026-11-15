<?php

namespace App\Http\Requests;

use App\Models\Treasury;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class UpdateTreasuryRequest extends FormRequest
{
    public function authorize(): bool
    {
        $treasury = Treasury::findOrFail((int) $this->route('id'));

        return Gate::allows('update', $treasury);
    }

    public function rules(): array
    {
        $accountId = $this->user()->getAccountId();

        return [
            'name' => ['nullable', 'string', 'max:100'],
            'branch_id' => [
                'nullable',
                'integer',
                Rule::exists('branches', 'id')->where('user_id', $accountId),
            ],
            'is_active' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
