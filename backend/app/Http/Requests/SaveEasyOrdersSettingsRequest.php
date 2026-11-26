<?php

namespace App\Http\Requests;

use App\Enums\EasyOrdersAuthMode;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveEasyOrdersSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwnerOrAdmin() ?? false;
    }

    protected function failedAuthorization(): void
    {
        throw new AuthorizationException('عذراً، إعدادات وربط متجر EasyOrders مخصصة لمالك المنشأة ومدير النظام فقط.');
    }

    public function rules(): array
    {
        $accountId = $this->user()->getAccountId();

        return [
            'store_id' => ['nullable', 'string', 'max:64'],
            'store_name' => ['nullable', 'string', 'max:255'],
            'auth_mode' => ['nullable', 'string', Rule::enum(EasyOrdersAuthMode::class)],
            'api_key' => ['nullable', 'string', 'max:500'],
            'webhook_secret' => ['nullable', 'string', 'max:255'],
            'default_branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where(fn ($q) => $q->where('user_id', $accountId)->whereNull('deleted_at'))],
            'auto_sync_stock' => ['boolean'],
            'is_active' => ['boolean'],
        ];
    }
}
