<?php

namespace App\Http\Requests;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveShopifyLocationMappingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwnerOrAdmin() ?? false;
    }

    protected function failedAuthorization(): void
    {
        throw new AuthorizationException('عذراً، ربط مواقع Shopify بالمخازن مخصص لمالك المنشأة ومدير النظام فقط.');
    }

    public function rules(): array
    {
        $accountId = $this->user()->getAccountId();

        return [
            'mappings' => ['required', 'array', 'min:1'],
            'mappings.*.id' => ['required', 'integer'],
            'mappings.*.branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where('user_id', $accountId)],
            'mappings.*.auto_sync_stock' => ['boolean'],
        ];
    }
}
