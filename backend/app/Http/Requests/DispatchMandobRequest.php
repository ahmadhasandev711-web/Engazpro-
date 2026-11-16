<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\HasScopedValidation;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;

class DispatchMandobRequest extends FormRequest
{
    use HasScopedValidation;

    private string $denyMessage = 'عذراً، إسناد الطلبات للمناديب متاح للمشرف والكاشير والإدارة فقط.';

    public function authorize(): bool
    {
        $user = $this->user();
        if (!$user || $user->isMandob()) {
            return false;
        }

        if ($user->isManager() && $user->branch_id && $this->filled('mandob_id')) {
            $mandob = User::where('owner_id', $user->getAccountId())->find((int) $this->input('mandob_id'));
            if ($mandob && $mandob->branch_id !== $user->branch_id) {
                $this->denyMessage = 'عذراً، يمكنك إسناد الطلبات لمناديب فرعك المعينين فقط.';

                return false;
            }
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
            'mandob_id' => ['required', 'integer', $this->scopedAccountUserExists()],
        ];
    }
}
