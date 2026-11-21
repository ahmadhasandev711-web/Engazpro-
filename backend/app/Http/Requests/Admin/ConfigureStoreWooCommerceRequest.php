<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ConfigureStoreWooCommerceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'store_url' => ['required', 'url', 'max:255'],
            'consumer_key' => ['nullable', 'string', 'max:255'],
            'consumer_secret' => ['nullable', 'string', 'max:255'],
            'webhook_secret' => ['nullable', 'string', 'max:255'],
            'online_branch_id' => ['nullable', 'integer'],
            'auto_sync_stock' => ['nullable', 'boolean'],
            'auto_sync_prices' => ['nullable', 'boolean'],
            'auto_sync_promotions' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'store_url.required' => 'رابط متجر WordPress / WooCommerce مطلوب',
            'store_url.url' => 'يرجى إدخال رابط متجر صحيح يبدأ بـ https://',
        ];
    }
}
