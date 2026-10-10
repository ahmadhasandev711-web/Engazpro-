<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $categories = Category::withCount('products')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => CategoryResource::collection($categories),
        ]);
    }

    public function store(CategoryRequest $request): JsonResponse
    {
        Gate::authorize('create', Category::class);

        $category = Category::create($request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء التصنيف بنجاح',
            'data' => new CategoryResource($category),
        ], 201);
    }

    public function update(CategoryRequest $request, int $id): JsonResponse
    {
        $category = Category::findOrFail($id);

        Gate::authorize('update', $category);

        $category->update($request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تعديل التصنيف بنجاح',
            'data' => new CategoryResource($category),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $category = Category::findOrFail($id);

        Gate::authorize('delete', $category);

        $category->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف التصنيف بنجاح',
        ]);
    }
}
