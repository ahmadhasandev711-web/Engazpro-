<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ExpenseRequest;
use App\Http\Resources\ExpenseResource;
use App\Models\Expense;
use App\Services\ExpenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ExpenseController extends Controller
{
    public function __construct(
        protected ExpenseService $expenseService
    ) {}

    /**
     * قائمة المصروفات مع التصفية والبحث
     */
    public function index(Request $request): JsonResponse
    {
        $result = $this->expenseService->getExpensesPaginated($request->user(), $request->all());
        $expenses = $result['paginator'];

        return response()->json([
            'success' => true,
            'data' => ExpenseResource::collection($expenses),
            'summary' => [
                'total_amount' => $result['total_amount'],
            ],
            'meta' => [
                'current_page' => $expenses->currentPage(),
                'last_page' => $expenses->lastPage(),
                'per_page' => $expenses->perPage(),
                'total' => $expenses->total(),
            ],
        ]);
    }

    /**
     * تسجيل مصروف جديد
     */
    public function store(ExpenseRequest $request): JsonResponse
    {
        Gate::authorize('create', Expense::class);

        $expense = $this->expenseService->createExpense($request->user(), $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل المصروف بنجاح وخصمه من الخزينة',
            'data' => new ExpenseResource($expense),
        ], 201);
    }

    /**
     * تفاصيل المصروف
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $expense = Expense::findOrFail($id);

        Gate::authorize('view', $expense);

        return response()->json([
            'success' => true,
            'data' => new ExpenseResource($expense),
        ]);
    }

    /**
     * تعديل بيانات المصروف
     */
    public function update(ExpenseRequest $request, int $id): JsonResponse
    {
        $expense = Expense::findOrFail($id);

        Gate::authorize('update', $expense);

        $updated = $this->expenseService->updateExpense($expense, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث المصروف بنجاح',
            'data' => new ExpenseResource($updated),
        ]);
    }

    /**
     * حذف المصروف
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $expense = Expense::findOrFail($id);

        Gate::authorize('delete', $expense);

        $this->expenseService->deleteExpense($expense);

        return response()->json([
            'success' => true,
            'message' => 'تم حذف المصروف بنجاح',
        ]);
    }
}
