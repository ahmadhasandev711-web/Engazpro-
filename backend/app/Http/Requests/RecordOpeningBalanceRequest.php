<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\HasScopedValidation;
use App\Models\Product;
use App\Services\BranchScopeService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;

class RecordOpeningBalanceRequest extends FormRequest
{
    use HasScopedValidation;

    public function authorize(): bool
    {
        $user = $this->user();
        if (!$user || !$user->can('create', Product::class)) {
            return false;
        }

        $requestedBranchId = $this->filled('branch_id') ? (int) $this->input('branch_id') : null;

        return app(BranchScopeService::class)->canAccessBranch($user, $requestedBranchId);
    }

    protected function failedAuthorization(): void
    {
        throw new AuthorizationException('عذراً، تسجيل رصيد أول المدة مخصص للإدارة فقط.');
    }

    public function rules(): array
    {
        return [
            'branch_id' => ['required', 'integer', $this->scopedExists('branches')],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', $this->scopedExists('products')],
            'items.*.product_variant_id' => ['nullable', 'integer', $this->scopedExists('product_variants')],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.cost_price' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
