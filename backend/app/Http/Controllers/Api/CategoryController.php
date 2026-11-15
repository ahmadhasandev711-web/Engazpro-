<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Services\CategoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class CategoryController extends Controller
{
    public function __construct(
        protected CategoryService $categoryService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $categories = $this->categoryService->listWithProductCount();

        return response()->json([
            'success' => true,
            'data' => CategoryResource::collection($categories),
        ]);
    }

    public function store(CategoryRequest $request): JsonResponse
    {
        Gate::authorize('create', Category::class);

        $category = $this->categoryService->create($request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء التصنيف بنجاح',
            'data' => new CategoryResource($category),
        ], 201);
    }

    public function update(CategoryRequest $request, int $id): JsonResponse
    {
        $category = $this->categoryService->findOrFail($id);

        Gate::authorize('update', $category);

        $updated = $this->categoryService->update($category, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تعديل التصنيف بنجاح',
            'data' => new CategoryResource($updated),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $category = $this->categoryService->findOrFail($id);

        Gate::authorize('delete', $category);

        $this->categoryService->delete($category);

        return response()->json([
            'success' => true,
            'message' => 'تم حذف التصنيف بنجاح',
        ]);
    }
}
