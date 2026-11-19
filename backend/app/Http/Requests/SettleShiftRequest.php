<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\HasScopedValidation;
use Illuminate\Foundation\Http\FormRequest;

class SettleShiftRequest extends FormRequest
{
    use HasScopedValidation;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'target_treasury_id' => ['nullable', 'integer', $this->scopedExists('treasuries')],
            'settlement_notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
