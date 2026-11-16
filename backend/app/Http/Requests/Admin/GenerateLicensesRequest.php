<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class GenerateLicensesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'count' => ['required', 'integer', 'min:1', 'max:100'],
            'duration_days' => ['required', 'integer', 'min:1', 'max:3650'],
            'plan' => ['nullable', 'string', 'max:50'],
            'price' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'ecommerce_enabled' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:255'],
        ];
    }
}
