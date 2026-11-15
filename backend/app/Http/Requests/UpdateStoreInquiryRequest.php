<?php

namespace App\Http\Requests;

use App\Enums\StoreInquiryStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStoreInquiryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['nullable', 'string', Rule::in(array_column(StoreInquiryStatus::cases(), 'value'))],
            'admin_notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
