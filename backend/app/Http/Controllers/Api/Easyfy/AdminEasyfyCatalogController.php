<?php

namespace App\Http\Controllers\Api\Easyfy;

use App\Http\Controllers\Controller;
use App\Http\Requests\Easyfy\Admin\SaveEasyfyCategoryRequest;
use App\Http\Requests\Easyfy\Admin\SaveEasyfyProductRequest;
use App\Http\Requests\Easyfy\Admin\UploadEasyfyImageRequest;
use App\Http\Resources\Easyfy\EasyfyCategoryResource;
use App\Http\Resources\Easyfy\EasyfyProductResource;
use App\Services\Easyfy\EasyfyCatalogAdminService;
use App\Services\Easyfy\EasyfyCatalogQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminEasyfyCatalogController extends Controller
{
    public function __construct(
        private readonly EasyfyCatalogAdminService $adminService,
        private readonly EasyfyCatalogQueryService $queryService,
    ) {}

    public function categories(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => EasyfyCategoryResource::collection($this->queryService->listAllCategories())]);
    }

    public function storeCategory(SaveEasyfyCategoryRequest $request): JsonResponse
    {
        $category = $this->adminService->saveCategory($request->validated());

        return response()->json(['success' => true, 'data' => new EasyfyCategoryResource($category)], 201);
    }

    public function updateCategory(SaveEasyfyCategoryRequest $request, int $id): JsonResponse
    {
        $category = $this->adminService->saveCategory($request->validated(), $id);

        return response()->json(['success' => true, 'data' => new EasyfyCategoryResource($category)]);
    }

    public function uploadCategoryImage(UploadEasyfyImageRequest $request, int $id): JsonResponse
    {
        $category = $this->adminService->uploadCategoryImage($id, $request->file('image'));

        return response()->json(['success' => true, 'data' => new EasyfyCategoryResource($category)]);
    }

    public function destroyCategory(int $id): JsonResponse
    {
        $this->adminService->deleteCategory($id);

        return response()->json(['success' => true, 'message' => 'تم حذف القسم بنجاح.']);
    }

    public function products(Request $request): JsonResponse
    {
        $products = $this->queryService->paginateAdminProducts($request->only(['category_id', 'stock_mode', 'search', 'per_page']));

        return response()->json([
            'success' => true,
            'data' => EasyfyProductResource::collection($products),
            'meta' => [
                'current_page' => $products->currentPage(), 'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(), 'total' => $products->total(),
            ],
        ]);
    }

    public function storeProduct(SaveEasyfyProductRequest $request): JsonResponse
    {
        $product = $this->adminService->saveProduct($request->user(), $request->validated());

        return response()->json(['success' => true, 'data' => new EasyfyProductResource($product)], 201);
    }

    public function updateProduct(SaveEasyfyProductRequest $request, int $id): JsonResponse
    {
        $product = $this->adminService->saveProduct($request->user(), $request->validated(), $id);

        return response()->json(['success' => true, 'data' => new EasyfyProductResource($product)]);
    }

    public function destroyProduct(int $id): JsonResponse
    {
        $this->adminService->deleteProduct($id);

        return response()->json(['success' => true, 'message' => 'تم حذف المنتج بنجاح.']);
    }

    public function uploadProductImage(UploadEasyfyImageRequest $request, int $id): JsonResponse
    {
        $img = $this->adminService->uploadProductImage(
            $id,
            $request->file('image'),
            (bool) $request->boolean('is_primary'),
            $request->validated('variant_id') ? (int) $request->validated('variant_id') : null
        );

        return response()->json(['success' => true, 'data' => $img], 201);
    }

    public function setPrimaryImage(int $productId, int $imageId): JsonResponse
    {
        $this->adminService->setPrimaryProductImage($productId, $imageId);

        return response()->json(['success' => true, 'message' => 'تم تعيين الصورة الرئيسية بنجاح.']);
    }

    public function destroyProductImage(int $imageId): JsonResponse
    {
        $this->adminService->deleteProductImage($imageId);

        return response()->json(['success' => true, 'message' => 'تم حذف الصورة بنجاح.']);
    }
}
