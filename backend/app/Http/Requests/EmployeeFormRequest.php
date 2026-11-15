<?php

namespace App\Http\Requests;

use App\Enums\CommissionType;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
        $phoneRule = Rule::unique('users', 'phone');
        $emailRule = Rule::unique('users', 'email');
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
            'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where(fn ($q) => $q->where('user_id', $accountId))],
        ];
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
