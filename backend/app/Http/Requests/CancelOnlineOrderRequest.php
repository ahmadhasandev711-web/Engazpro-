<?php

namespace App\Http\Requests;

use App\Enums\OrderCancelReason;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class CancelOnlineOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('operate-online-order');
    }

    protected function failedAuthorization(): void
    {
        throw new AuthorizationException('عذراً، إلغاء طلبات المتجر متاح للمشرف والكاشير والإدارة فقط.');
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', Rule::enum(OrderCancelReason::class)],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function cancelReasonEnum(): OrderCancelReason
    {
        return OrderCancelReason::from((string) $this->validated('reason'));
    }
}
