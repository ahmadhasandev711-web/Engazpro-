<?php

namespace App\Http\Requests\Admin;

use App\Enums\EasyOrdersAuthMode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ConfigureStoreEasyOrdersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'store_id' => ['nullable', 'string', 'max:64'],
            'store_name' => ['nullable', 'string', 'max:255'],
            'auth_mode' => ['nullable', 'string', Rule::enum(EasyOrdersAuthMode::class)],
            'api_key' => ['nullable', 'string', 'max:500'],
            'webhook_secret' => ['nullable', 'string', 'max:255'],
            'online_branch_id' => ['nullable', 'integer'],
            'default_branch_id' => ['nullable', 'integer'],
            'auto_sync_stock' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
