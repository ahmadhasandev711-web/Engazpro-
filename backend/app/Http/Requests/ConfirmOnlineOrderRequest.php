<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\HasScopedValidation;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;

class ConfirmOnlineOrderRequest extends FormRequest
{
    use HasScopedValidation;

    private string $denyMessage = 'عذراً، تأكيد وتجهيز الطلبات متاح للمشرف والكاشير والإدارة فقط.';

    public function authorize(): bool
    {
        $user = $this->user();
        if (!$user || $user->isMandob()) {
            return false;
        }

        if ($user->isManager() && $user->branch_id && (int) $this->input('branch_id') !== (int) $user->branch_id) {
            $this->denyMessage = 'عذراً، كمدير فرع يمكنك تأكيد وتجهيز الطلبات من مخزن فرعك فقط.';

            return false;
        }

        return true;
    }

    protected function failedAuthorization(): void
    {
        throw new AuthorizationException($this->denyMessage);
    }

    public function rules(): array
    {
        return [
            'branch_id' => ['required', 'integer', $this->scopedExists('branches')],
            'force' => ['nullable', 'boolean'],
        ];
    }

    public function resolvedBranchId(): int
    {
        $user = $this->user();

        return ($user->isManager() && $user->branch_id)
            ? (int) $user->branch_id
            : (int) $this->validated('branch_id');
    }
}
