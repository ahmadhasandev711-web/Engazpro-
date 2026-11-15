<?php

namespace App\Http\Requests;

use App\Rules\PublicHttpsUrl;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;

class SaveWooCommerceSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwnerOrAdmin() ?? false;
    }

    protected function failedAuthorization(): void
    {
        throw new AuthorizationException(
            'عذراً، إعدادات وربط متجر ووكومرس مخصصة لمالك المنشأة ومدير النظام فقط.'
        );
    }

    public function rules(): array
    {
        return [
            'store_url' => ['required', 'url', new PublicHttpsUrl()],
            'consumer_key' => ['nullable', 'string'],
            'consumer_secret' => ['nullable', 'string'],
            'online_branch_id' => ['nullable', 'exists:branches,id'],
            'auto_sync_stock' => ['boolean'],
            'is_active' => ['boolean'],
        ];
    }
}
