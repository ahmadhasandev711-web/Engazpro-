<?php

namespace App\Http\Requests\Easyfy\Admin;

use App\Enums\Easyfy\EasyfyOrderStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class UpdateEasyfyOrderStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'string', new Enum(EasyfyOrderStatus::class)],
            'courier_name' => ['nullable', 'string', 'max:120'],
            'tracking_number' => ['nullable', 'string', 'max:120'],
            'admin_notes' => ['nullable', 'string', 'max:1000'],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
