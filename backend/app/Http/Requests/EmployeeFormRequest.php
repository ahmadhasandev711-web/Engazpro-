<?php

namespace App\Http\Requests;

use App\Enums\CommissionType;
use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\User;
use App\Support\PhoneNormalizer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

abstract class EmployeeFormRequest extends FormRequest
{
    /** @return list<string> */
    protected function allowedRolesFor(User $actor): array
    {
        if ($actor->isManager()) {
            return [
                UserRole::SUPERVISOR->value,
                UserRole::MANDOB->value,
                UserRole::CASHIER->value,
                UserRole::SALES->value,
            ];
        }

        return [
            UserRole::ADMIN->value,
            UserRole::MANAGER->value,
            UserRole::SUPERVISOR->value,
            UserRole::MANDOB->value,
            UserRole::CASHIER->value,
            UserRole::SALES->value,
        ];
    }

    protected function sharedRules(User $actor, ?int $ignoreUserId = null): array
    {
        $accountId = $actor->getAccountId();
        $storeCode = (string) (User::whereKey($accountId)->value('store_code') ?? $actor->store_code);
        $phoneRule = Rule::unique('users', 'phone')->where(fn ($q) => $q->where('store_code', $storeCode));
        $emailRule = Rule::unique('users', 'email')->where(fn ($q) => $q->where('store_code', $storeCode));
        if ($ignoreUserId !== null) {
            $phoneRule->ignore($ignoreUserId);
            $emailRule->ignore($ignoreUserId);
        }

        return [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:20', $phoneRule],
            'email' => ['nullable', 'email', 'max:255', $emailRule],
            'role' => ['required', 'string', Rule::in($this->allowedRolesFor($actor))],
            'base_salary' => ['nullable', 'numeric', 'min:0'],
            'commission_type' => ['nullable', 'string', Rule::in(array_column(CommissionType::cases(), 'value'))],
            'commission_rate' => ['nullable', 'numeric', 'min:0'],
            'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where(fn ($q) => $q->where('user_id', $accountId)->whereNull('deleted_at'))],
        ];
    }

    protected function prepareForValidation(): void
    {
        $merged = [];
        if ($this->has('phone')) {
            $merged['phone'] = PhoneNormalizer::canonical((string) $this->input('phone'));
        }
        if ($this->filled('email')) {
            $merged['email'] = strtolower(trim((string) $this->input('email')));
        }
        $actor = $this->user();
        if ($actor && $actor->isBranchScoped() && $actor->branch_id !== null && !$this->filled('branch_id')) {
            $merged['branch_id'] = $actor->branch_id;
        }
        if ($merged !== []) {
            $this->merge($merged);
        }
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $actor = $this->user();
            $role = (string) $this->input('role');
            $requiresBranch = in_array($role, [UserRole::CASHIER->value, UserRole::SALES->value], true);

            if ($actor && $actor->isBranchScoped() && $actor->branch_id !== null && $this->filled('branch_id')
                && (int) $this->input('branch_id') !== (int) $actor->branch_id) {
                $v->errors()->add('branch_id', 'عذراً، لا يمكنك تعيين أو نقل موظف خارج فرعك المحدد.');
                return;
            }

            if ($requiresBranch && !$this->filled('branch_id') && $actor && Branch::where('user_id', $actor->getAccountId())->exists()) {
                $v->errors()->add('branch_id', 'يجب تحديد فرع محدد لدور الكاشير وبائع الصالة عند وجود فروع بالمنشأة.');
            }
        });
    }

    public function messages(): array
    {
        return [
            'name.required' => 'اسم الموظف مطلوب',
            'phone.required' => 'رقم الهاتف مطلوب',
            'phone.unique' => 'رقم الهاتف مسجل بالفعل لمستخدم آخر',
            'email.unique' => 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر',
            'password.required' => 'كلمة المرور مطلوبة',
            'password.min' => 'كلمة المرور يجب ألا تقل عن 6 خانات',
            'role.in' => $this->user()->isManager() ? 'عذراً، يمكنك إضافة موظفين برتبة مشرف أو كاشير أو مندوب أو سيلز فقط' : 'الدور المحدد غير صحيح',
            'branch_id.exists' => 'الفرع المحدد غير موجود أو لا يتبع لمنشأتك',
        ];
    }
}
