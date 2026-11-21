<?php

namespace App\Http\Requests;

use App\Enums\ExchangeSource;
use App\Enums\ExchangeStatus;
use App\Http\Requests\Concerns\HasScopedValidation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class IndexExchangeRequest extends FormRequest
{
    use HasScopedValidation;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:100'],
            'source' => ['nullable', 'string', new Enum(ExchangeSource::class)],
            'status' => ['nullable', 'string', new Enum(ExchangeStatus::class)],
            'branch_id' => ['nullable', $this->scopedExists('branches')],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
