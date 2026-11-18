<?php

namespace App\Http\Requests;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

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

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $branchIds = collect($this->input('mappings', []))
                ->pluck('branch_id')
                ->filter(fn ($id) => $id !== null && $id !== '')
                ->map(fn ($id) => (int) $id);

            if ($branchIds->count() !== $branchIds->unique()->count()) {
                $v->errors()->add('mappings', 'لا يمكن ربط أكثر من موقع Shopify بنفس المخزن/الفرع (قاعدة 1-to-1) لمنع تضاعف الأرصدة.');
            }
        });
    }
}
