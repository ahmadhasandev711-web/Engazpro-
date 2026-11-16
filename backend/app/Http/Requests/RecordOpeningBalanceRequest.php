<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\HasScopedValidation;
use App\Models\Product;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;

class RecordOpeningBalanceRequest extends FormRequest
{
    use HasScopedValidation;

    public function authorize(): bool
    {
        return $this->user()?->can('create', Product::class) ?? false;
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
