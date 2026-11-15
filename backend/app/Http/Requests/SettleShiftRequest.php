<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SettleShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'target_treasury_id' => ['nullable', 'integer'],
            'settlement_notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
