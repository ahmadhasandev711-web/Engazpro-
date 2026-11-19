<?php

namespace App\Http\Requests;

use App\Enums\BranchType;
use App\Http\Requests\Concerns\HasScopedValidation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TransferOnlineOrderBranchRequest extends FormRequest
{
    use HasScopedValidation;

    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && ($user->isOwnerOrAdmin() || $user->isManager() || $user->isSupervisor());
    }

    public function rules(): array
    {
        $accountId = $this->user()->getAccountId();

        return [
            'target_branch_id' => [
                'required',
                'integer',
                Rule::exists('branches', 'id')
                    ->where('user_id', $accountId)
                    ->where('is_active', true)
                    ->whereIn('type', BranchType::fixedValues()),
            ],
            'reason' => ['nullable', 'string', 'max:300'],
        ];
    }

    public function messages(): array
    {
        return [
            'target_branch_id.required' => 'يرجى تحديد الفرع المستهدف لتحويل الطلب.',
            'target_branch_id.exists' => 'الفرع المختار غير متاح أو غير ثابت.',
        ];
    }
}
