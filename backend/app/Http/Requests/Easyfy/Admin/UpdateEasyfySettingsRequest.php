<?php

namespace App\Http\Requests\Easyfy\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateEasyfySettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'store_enabled' => ['nullable', 'boolean'],
            'cod_enabled' => ['nullable', 'boolean'],
            'instapay_enabled' => ['nullable', 'boolean'],
            'vodafone_cash_enabled' => ['nullable', 'boolean'],
            'instapay_handle' => ['nullable', 'string', 'max:150'],
            'instapay_name' => ['nullable', 'string', 'max:150'],
            'vodafone_cash_number' => ['nullable', 'string', 'max:40'],
            'default_shipping_fee' => ['nullable', 'numeric', 'min:0'],
            'free_shipping_threshold' => ['nullable', 'numeric', 'min:0'],
            'support_whatsapp' => ['nullable', 'string', 'max:40'],
            'admin_notification_email' => ['nullable', 'email', 'max:160'],
            'invoice_footer' => ['nullable', 'string', 'max:500'],
        ];
    }
}
