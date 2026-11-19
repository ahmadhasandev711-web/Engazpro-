<?php

namespace App\Http\Requests;

use App\Enums\PartyType;
use App\Services\BranchScopeService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DispatchCourierRequest extends FormRequest
{
    private string $denyMessage = 'عذراً، إسناد الطلبات لشركات الشحن متاح للمشرف والكاشير والإدارة فقط.';

    public function authorize(): bool
    {
        $user = $this->user();
        if (!$user || $user->isMandob()) {
            return false;
        }

        if ($this->filled('branch_id') && !app(BranchScopeService::class)->canAccessBranch($user, (int) $this->input('branch_id'))) {
            $this->denyMessage = 'عذراً، يمكنك شحن الطلبات من فرعك المعين فقط.';

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
        $accountId = $this->user()->getAccountId();

        return [
            'courier_party_id' => [
                'required',
                'integer',
                Rule::exists('parties', 'id')->where(function ($q) use ($accountId) {
                    $q->where('user_id', $accountId)->where('type', PartyType::COURIER->value);
                }),
            ],
            'courier_name' => ['nullable', 'string', 'max:255'],
            'tracking_number' => ['nullable', 'string', 'max:255'],
            'branch_id' => [
                'nullable',
                'integer',
                Rule::exists('branches', 'id')->where(fn ($q) => $q->where('user_id', $accountId)->whereNull('deleted_at')),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'courier_party_id.required' => 'يرجى اختيار شركة شحن مسجلة بالدفاتر لإسناد الشحنة وتوثيق المديونية.',
            'courier_party_id.exists' => 'شركة الشحن المحددة غير صالحة أو غير مسجلة بالدفاتر.',
        ];
    }
}
