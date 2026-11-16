<?php

namespace App\Http\Requests;

use App\Enums\StockAdjustmentMode;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdjustStockRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && ($user->isOwnerOrAdmin() || $user->isManager());
    }

    protected function failedAuthorization(): void
    {
        throw new AuthorizationException('عذراً، تسوية الجرد والتالف متاحة للمالك والإدارة ومديري الفروع فقط.');
    }

    public function rules(): array
    {
        $accountId = $this->user()->getAccountId();

        return [
            'branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('user_id', $accountId)],
            'product_id' => ['required', 'integer', Rule::exists('products', 'id')->where('user_id', $accountId)],
            'product_variant_id' => ['nullable', 'integer', Rule::exists('product_variants', 'id')->where('user_id', $accountId)],
            'product_batch_id' => ['nullable', 'integer', Rule::exists('product_batches', 'id')->where('user_id', $accountId)],
            'mode' => ['required', 'string', Rule::enum(StockAdjustmentMode::class)],
            'quantity' => ['required', 'numeric', 'min:0'],
            'reason' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
