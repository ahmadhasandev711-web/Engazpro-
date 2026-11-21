<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ConfigureStoreShopifyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'shop_domain' => ['required', 'string', 'max:255'],
            'access_token' => ['nullable', 'string', 'max:500'],
            'client_id' => ['nullable', 'string', 'max:255'],
            'client_secret' => ['nullable', 'string', 'max:500'],
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
            'shop_domain.required' => 'دومين متجر Shopify مطلوب (مثال: my-brand.myshopify.com)',
        ];
    }
}
