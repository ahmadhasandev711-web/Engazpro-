<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductImageRequest;
use App\Http\Requests\ProductRequest;
use App\Http\Requests\RecordOpeningBalanceRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Services\BranchAvailabilityService;
use App\Services\ProductImageService;
use App\Services\ProductService;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ProductController extends Controller
{
    public function __construct(
        protected ProductService $productService,
        protected StockService $stockService,
        protected ProductImageService $productImageService
    ) {}

    /**
     * قائمة الأصناف مع البحث والفلترة والتصفح
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->all();
        $products = $this->productService->getProductsPaginated($request->user(), $filters);

        return response()->json([
            'success' => true,
            'data' => ProductResource::collection($products),
            'summary' => $this->productService->getProductsSummary($filters),
            'meta' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
            ],
        ]);
    }

    public function posCatalog(Request $request): JsonResponse
    {
        $request->attributes->set('pos_catalog', true);
        $products = $this->productService->getPosCatalog($request->user(), $request->all());

        return response()->json([
            'success' => true,
            'data' => ProductResource::collection($products),
            'meta' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
            ],
        ]);
    }

    public function lookup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:100'],
            'branch_id' => ['nullable', 'integer'],
        ]);

        $request->attributes->set('pos_catalog', true);
        $match = $this->productService->findByScanCode(
            $request->user(),
            $validated['code'],
            isset($validated['branch_id']) ? (int) $validated['branch_id'] : null
        );

        if (!$match) {
            return response()->json([
                'success' => false,
                'message' => 'لم يتم العثور على صنف بهذا الباركود',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => new ProductResource($match['product']),
            'matched_variant_id' => $match['variant_id'],
        ]);
    }

    /**
     * إضافة صنف جديد
     */
    public function store(ProductRequest $request): JsonResponse
    {
        Gate::authorize('create', Product::class);

        $product = $this->productService->createProduct($request->user(), $request->validated());
        $this->productService->loadProductDetails($product);

        return response()->json([
            'success' => true,
            'message' => 'تمت إضافة الصنف بنجاح',
            'data' => new ProductResource($product),
        ], 201);
    }

    /**
     * عرض بيانات الصنف
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $product = $this->productService->findForShowOrFail($id);

        Gate::authorize('view', $product);

        return response()->json([
            'success' => true,
            'data' => new ProductResource($product),
        ]);
    }

    /**
     * الاستعلام عن توافر الصنف ومتغيراته في الفروع والمخازن الثابتة (قراءة فقط)
     */
    public function branchAvailability(Request $request, int $id, BranchAvailabilityService $availabilityService): JsonResponse
    {
        $product = $this->productService->findOrFail($id);
        Gate::authorize('view', $product);

        return response()->json([
            'success' => true,
            'data' => $availabilityService->getProductAvailability($request->user(), $product),
        ]);
    }

    /**
     * تعديل بيانات الصنف
     */
    public function update(ProductRequest $request, int $id): JsonResponse
    {
        $product = $this->productService->findOrFail($id);
        Gate::authorize('update', $product);

        $product = $this->productService->updateProduct($product, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تعديل بيانات الصنف بنجاح',
            'data' => new ProductResource($product->load('category')),
        ]);
    }

    /**
     * حذف الصنف
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $product = $this->productService->findOrFail($id);
        Gate::authorize('delete', $product);

        $this->productService->deleteProduct($product);

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الصنف بنجاح',
        ]);
    }

    /**
     * إضافة تشغيلة جديدة لصنف بصلاحية
     */
    public function addBatch(Request $request, int $id): JsonResponse
    {
        $product = $this->productService->findOrFail($id);
        Gate::authorize('update', $product);

        $validated = $request->validate([
            'batch_number' => ['required', 'string', 'max:100'],
            'expiry_date' => ['required', 'date'],
            'production_date' => ['nullable', 'date'],
            'quantity' => ['nullable', 'numeric', 'min:0'],
            'purchase_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $batch = $this->productService->addBatch($request->user(), $product, $validated);

        return response()->json([
            'success' => true,
            'message' => 'تمت إضافة التشغيلة وتحديث المخزون بنجاح',
            'data' => $batch,
        ], 201);
    }

    /**
     * تسجيل رصيد أول المدة لدفعة من الأصناف
     */
    public function recordOpeningBalance(RecordOpeningBalanceRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $result = $this->stockService->recordOpeningBalance(
            $request->user(),
            (int) $validated['branch_id'],
            $validated['items']
        );

        return response()->json([
            'success' => true,
            'message' => "تم تسجيل رصيد أول المدة بنجاح لـ {$result['updated_count']} صنف في فرع {$result['branch_name']}",
            'data' => $result,
        ]);
    }

    /**
     * رفع أو تحديث صورة الصنف
     */
    public function uploadImage(ProductImageRequest $request, int $id): JsonResponse
    {
        $product = $this->productService->findOrFail($id);
        Gate::authorize('update', $product);

        $updated = $this->productImageService->uploadProductImage(
            $request->user(),
            $product,
            $request->file('image')
        );

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث صورة الصنف بنجاح',
            'data' => new ProductResource($updated),
        ]);
    }

    /**
     * إزالة صورة الصنف
     */
    public function deleteImage(int $id): JsonResponse
    {
        $product = $this->productService->findOrFail($id);
        Gate::authorize('update', $product);

        $updated = $this->productImageService->removeProductImage($product);

        return response()->json([
            'success' => true,
            'message' => 'تم إزالة صورة الصنف بنجاح',
            'data' => new ProductResource($updated),
        ]);
    }
}
