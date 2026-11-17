<?php

namespace App\Http\Requests;

use App\Enums\OnlineOrderCallStatus;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class LogOnlineOrderCallRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('operate-online-order');
    }

    protected function failedAuthorization(): void
    {
        throw new AuthorizationException('عذراً، تسجيل مكالمات الكول سنتر متاح للمشرف والكاشير والإدارة فقط.');
    }

    public function rules(): array
    {
        return [
            'call_status' => [
                'required',
                Rule::in(array_map(
                    fn (OnlineOrderCallStatus $status): string => $status->value,
                    OnlineOrderCallStatus::pendingFollowUpCases()
                )),
            ],
            'call_scheduled_at' => [
                'nullable',
                'date',
                Rule::requiredIf(
                    fn () => $this->input('call_status') === OnlineOrderCallStatus::CALLBACK_SCHEDULED->value
                ),
            ],
            'call_notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function callStatusEnum(): OnlineOrderCallStatus
    {
        return OnlineOrderCallStatus::from((string) $this->validated('call_status'));
    }
}
