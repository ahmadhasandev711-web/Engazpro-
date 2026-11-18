<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePlatformPricingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'basic_monthly_price' => ['required', 'numeric', 'min:1', 'max:100000'],
            'basic_annual_price' => ['required', 'numeric', 'min:1', 'max:1000000'],
            'pro_monthly_price' => ['required', 'numeric', 'min:1', 'max:100000'],
            'pro_annual_price' => ['required', 'numeric', 'min:1', 'max:1000000'],
            'trial_days' => ['required', 'integer', 'min:1', 'max:90'],
        ];
    }
}
