<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ExpenseCategoryResource;
use App\Models\ExpenseCategory;
use App\Services\ExpenseCategoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseCategoryController extends Controller
{
    public function __construct(
        protected ExpenseCategoryService $categoryService
    ) {}

    /**
     * قائمة تصنيفات المصروفات للمتجر
     */
    public function index(Request $request): JsonResponse
    {
        $categories = $this->categoryService->getCategoriesForUser($request->user());

        return response()->json([
            'success' => true,
            'data' => ExpenseCategoryResource::collection($categories),
        ]);
    }

    /**
     * إضافة تصنيف مصروفات جديد
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ], [
            'name.required' => 'يرجى إدخال اسم التصنيف',
            'name.max' => 'اسم التصنيف لا يتجاوز 100 حرف',
        ]);

        $category = $this->categoryService->createCategory($request->user(), $validated['name']);

        return response()->json([
            'success' => true,
            'message' => "تمت إضافة التصنيف '{$category->name}' بنجاح",
            'data' => new ExpenseCategoryResource($category),
        ], 201);
    }

    /**
     * تعديل اسم تصنيف المصروفات
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $category = ExpenseCategory::where('user_id', $user->getAccountId())->findOrFail($id);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ], [
            'name.required' => 'يرجى إدخال اسم التصنيف الجديد',
            'name.max' => 'اسم التصنيف لا يتجاوز 100 حرف',
        ]);

        $updated = $this->categoryService->updateCategory($user, $category, $validated['name']);

        return response()->json([
            'success' => true,
            'message' => 'تم تعديل اسم التصنيف بنجاح',
            'data' => new ExpenseCategoryResource($updated),
        ]);
    }

    /**
     * حذف تصنيف المصروفات
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $category = ExpenseCategory::where('user_id', $user->getAccountId())->findOrFail($id);

        $this->categoryService->deleteCategory($user, $category);

        return response()->json([
            'success' => true,
            'message' => 'تم حذف التصنيف بنجاح',
        ]);
    }
}
