<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DisbursePayrollRequest;
use App\Http\Requests\PayrollAdjustmentRequest;
use App\Models\User;
use App\Services\PayrollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class PayrollController extends Controller
{
    public function __construct(
        protected PayrollService $payrollService
    ) {}

    /**
     * استعراض ملخص مسير الراتب والعمولة والتسويات لشهر محدد
     */
    public function summary(Request $request, int $employeeId): JsonResponse
    {
        $employee = $this->findEmployee($request, $employeeId);
        Gate::authorize('view', [\App\Models\PayrollPayout::class, $employee]);

        $month = $request->query('month', now()->format('Y-m'));
        if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
            $month = now()->format('Y-m');
        }

        $summary = $this->payrollService->calculateMonthlyPayroll($employee, $month);

        return response()->json([
            'success' => true,
            'data' => $summary,
        ]);
    }

    /**
     * إضافة تسوية مالية (مكافأة، خصم، سلفة)
     */
    public function addAdjustment(PayrollAdjustmentRequest $request, int $employeeId): JsonResponse
    {
        $employee = $this->findEmployee($request, $employeeId);
        Gate::authorize('manage', [\App\Models\PayrollPayout::class, $employee]);

        $adjustment = $this->payrollService->addAdjustment($request->user(), $employee, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم إضافة التسوية المالية بنجاح.',
            'data' => $adjustment,
        ], 201);
    }

    /**
     * حذف تسوية مالية
     */
    public function deleteAdjustment(Request $request, int $adjustmentId): JsonResponse
    {
        $this->payrollService->deleteAdjustment($request->user(), $adjustmentId);

        return response()->json([
            'success' => true,
            'message' => 'تم حذف التسوية المالية بنجاح.',
        ]);
    }

    /**
     * صرف الراتب الشهري وخصمه من الخزينة وتسجيل المصروف ذرياً
     */
    public function disburse(DisbursePayrollRequest $request, int $employeeId): JsonResponse
    {
        $employee = $this->findEmployee($request, $employeeId);
        Gate::authorize('manage', [\App\Models\PayrollPayout::class, $employee]);

        $payout = $this->payrollService->disbursePayroll($request->user(), $employee, $request->validated());

        return response()->json([
            'success' => true,
            'message' => "تم صرف راتب شهر {$payout->month} بنجاح وتسجيل المصروف.",
            'data' => $payout,
        ]);
    }

    protected function findEmployee(Request $request, int $employeeId): User
    {
        $accountId = $request->user()->getAccountId();
        return User::where(function ($q) use ($accountId) {
            $q->where('owner_id', $accountId)->orWhere('id', $accountId);
        })->findOrFail($employeeId);
    }
}
