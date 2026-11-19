<?php

namespace App\Http\Requests;

use App\Enums\CustomerInteractionChannel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePartyInteractionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'channel' => ['required', 'string', Rule::in(array_column(CustomerInteractionChannel::cases(), 'value'))],
            'notes' => ['required', 'string', 'max:2000'],
            'follow_up_at' => ['nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'channel.required' => 'يرجى تحديد قناة أو نوع التفاعل.',
            'channel.in' => 'قناة التفاعل المحددة غير مدعومة.',
            'notes.required' => 'يرجى كتابة تفاصيل الملاحظة أو المكالمة.',
        ];
    }
}
