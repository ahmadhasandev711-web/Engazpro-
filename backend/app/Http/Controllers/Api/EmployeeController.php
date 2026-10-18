<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\EmployeeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class EmployeeController extends Controller
{
    public function __construct(
        protected EmployeeService $employeeService
    ) {}

    /**
     * استعراض قائمة فريق العمل والمناديب
     */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', User::class);

        $employees = $this->employeeService->getEmployeesWithTodayStats($request->user());

        return response()->json([
            'success' => true,
            'data' => $employees,
        ]);
    }

    /**
     * إضافة موظف جديد (مندوب / كاشير / مدير / مشرف)
     */
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', User::class);

        $user = $request->user();
        $accountId = $user->getAccountId();
        $allowedRoles = [
            UserRole::ADMIN->value,
            UserRole::MANAGER->value,
            UserRole::SUPERVISOR->value,
            UserRole::MANDOB->value,
            UserRole::CASHIER->value,
            UserRole::SALES->value,
        ];
        if ($user->isManager()) {
            $allowedRoles = [
                UserRole::SUPERVISOR->value,
                UserRole::MANDOB->value,
                UserRole::CASHIER->value,
                UserRole::SALES->value,
            ];
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:20', 'unique:users,phone'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', 'string', Rule::in($allowedRoles)],
            'base_salary' => ['nullable', 'numeric', 'min:0'],
            'commission_type' => ['nullable', 'string', Rule::in(['NONE', 'PERCENTAGE_OF_SALES', 'FIXED_PER_INVOICE'])],
            'commission_rate' => ['nullable', 'numeric', 'min:0'],
            'branch_id' => [
                'nullable',
                'integer',
                Rule::exists('branches', 'id')->where(fn($q) => $q->where('user_id', $accountId)),
            ],
        ], [
            'name.required' => 'اسم الموظف مطلوب',
            'phone.required' => 'رقم الهاتف مطلوب',
            'phone.unique' => 'رقم الهاتف مسجل بالفعل لمستخدم آخر',
            'email.unique' => 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر',
            'password.required' => 'كلمة المرور مطلوبة',
            'password.min' => 'كلمة المرور يجب ألا تقل عن 6 خانات',
            'role.in' => $user->isManager() ? 'عذراً، يمكنك إضافة موظفين برتبة مشرف أو كاشير أو مندوب أو سيلز فقط' : 'الدور المحدد غير صحيح',
            'branch_id.exists' => 'الفرع المحدد غير موجود أو لا يتبع لمنشأتك',
        ]);

        if ($user->isManager()) {
            $validated['branch_id'] = $user->branch_id;
        }

        $employee = $this->employeeService->createEmployee($user, $validated);

        return response()->json([
            'success' => true,
            'message' => 'تمت إضافة الموظف بنجاح إلى فريق العمل',
            'data' => new UserResource($employee),
        ], 201);
    }

    /**
     * تعديل بيانات الموظف
     */
    public function update(Request $request, User $employee): JsonResponse
    {
        Gate::authorize('update', $employee);

        $user = $request->user();
        $accountId = $user->getAccountId();
        $allowedRoles = [
            UserRole::ADMIN->value,
            UserRole::MANAGER->value,
            UserRole::SUPERVISOR->value,
            UserRole::MANDOB->value,
            UserRole::CASHIER->value,
            UserRole::SALES->value,
        ];
        if ($user->isManager()) {
            $allowedRoles = [
                UserRole::SUPERVISOR->value,
                UserRole::MANDOB->value,
                UserRole::CASHIER->value,
                UserRole::SALES->value,
            ];
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:20', Rule::unique('users', 'phone')->ignore($employee->id)],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($employee->id)],
            'password' => ['nullable', 'string', 'min:6'],
            'role' => ['required', 'string', Rule::in($allowedRoles)],
            'base_salary' => ['nullable', 'numeric', 'min:0'],
            'commission_type' => ['nullable', 'string', Rule::in(['NONE', 'PERCENTAGE_OF_SALES', 'FIXED_PER_INVOICE'])],
            'commission_rate' => ['nullable', 'numeric', 'min:0'],
            'branch_id' => [
                'nullable',
                'integer',
                Rule::exists('branches', 'id')->where(fn($q) => $q->where('user_id', $accountId)),
            ],
        ], [
            'name.required' => 'اسم الموظف مطلوب',
            'phone.required' => 'رقم الهاتف مطلوب',
            'phone.unique' => 'رقم الهاتف مسجل بالفعل لمستخدم آخر',
            'email.unique' => 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر',
            'password.min' => 'كلمة المرور يجب ألا تقل عن 6 خانات',
            'role.in' => $user->isManager() ? 'عذراً، يمكنك تعيين موظفين برتبة مشرف أو كاشير أو مندوب أو سيلز فقط' : 'الدور غير صالح',
            'branch_id.exists' => 'الفرع المحدد غير موجود أو لا يتبع لمنشأتك',
        ]);

        if ($user->isManager()) {
            $validated['branch_id'] = $user->branch_id;
        }

        $updated = $this->employeeService->updateEmployee($employee, $validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث بيانات الموظف بنجاح',
            'data' => new UserResource($updated),
        ]);
    }

    /**
     * تفعيل أو إيقاف حساب الموظف
     */
    public function toggleStatus(Request $request, User $employee): JsonResponse
    {
        Gate::authorize('update', $employee);

        $updated = $this->employeeService->toggleStatus($employee);

        return response()->json([
            'success' => true,
            'message' => $updated->status === 'ACTIVE' ? 'تم تفعيل حساب الموظف' : 'تم إيقاف حساب الموظف',
            'data' => new UserResource($updated),
        ]);
    }

    /**
     * حذف حساب موظف
     */
    public function destroy(Request $request, User $employee): JsonResponse
    {
        Gate::authorize('delete', $employee);

        $this->employeeService->deleteEmployee($employee);

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الموظف بنجاح',
        ]);
    }
}
