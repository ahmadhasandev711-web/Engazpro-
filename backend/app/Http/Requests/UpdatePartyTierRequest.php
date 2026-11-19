<?php

namespace App\Http\Requests;

use App\Enums\CustomerTier;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePartyTierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tier' => ['nullable', 'string', Rule::in(array_column(CustomerTier::cases(), 'value'))],
        ];
    }

    public function messages(): array
    {
        return [
            'tier.in' => 'تصنيف العميل المحدد غير صحيح.',
        ];
    }
}
