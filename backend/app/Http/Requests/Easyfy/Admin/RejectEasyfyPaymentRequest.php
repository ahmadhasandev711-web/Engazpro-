<?php

namespace App\Http\Requests\Easyfy\Admin;

use Illuminate\Foundation\Http\FormRequest;

class RejectEasyfyPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'max:500'],
        ];
    }
}
