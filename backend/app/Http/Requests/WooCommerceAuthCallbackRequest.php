<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class WooCommerceAuthCallbackRequest extends FormRequest
{
    /**
     * Public callback from WordPress/WooCommerce - authorized by payload identity
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'consumer_key' => ['required', 'string'],
            'consumer_secret' => ['required', 'string'],
            'user_id' => ['nullable'],
            'account_id' => ['nullable'],
        ];
    }
}
