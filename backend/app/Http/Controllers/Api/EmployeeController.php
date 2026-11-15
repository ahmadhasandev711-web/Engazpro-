<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEmployeeRequest;
use App\Http\Requests\UpdateEmployeeRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\EmployeeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class EmployeeController extends Controller
{
    public function __construct(
        protected EmployeeService $employeeService
    ) {}

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', User::class);

        $employees = $this->employeeService->getEmployeesWithTodayStats($request->user());

        return response()->json([
            'success' => true,
            'data' => $employees,
        ]);
    }

    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();
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

    public function update(UpdateEmployeeRequest $request, User $employee): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();
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

    public function toggleStatus(Request $request, User $employee): JsonResponse
    {
        Gate::authorize('update', $employee);

        $updated = $this->employeeService->toggleStatus($employee);
        $isActive = $updated->status === UserStatus::ACTIVE || $updated->status === UserStatus::ACTIVE->value;

        return response()->json([
            'success' => true,
            'message' => $isActive ? 'تم تفعيل حساب الموظف' : 'تم إيقاف حساب الموظف',
            'data' => new UserResource($updated),
        ]);
    }

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
