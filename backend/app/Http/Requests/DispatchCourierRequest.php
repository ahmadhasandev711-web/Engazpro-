<?php

namespace App\Http\Requests;

use App\Enums\PartyType;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DispatchCourierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return !($this->user()?->isMandob() ?? true);
    }

    protected function failedAuthorization(): void
    {
        throw new AuthorizationException(
            'عذراً، إسناد الطلبات لشركات الشحن متاح للمشرف والكاشير والإدارة فقط.'
        );
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
                Rule::exists('branches', 'id')->where('user_id', $accountId),
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
