<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Services\ProductService;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ProductController extends Controller
{
    public function __construct(
        protected ProductService $productService,
        protected StockService $stockService
    ) {}

    /**
     * قائمة الأصناف مع البحث والفلترة والتصفح
     */
    public function index(Request $request): JsonResponse
    {
        $products = $this->productService->getProductsPaginated($request->user(), $request->all());

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

        $product->load('category');
        $product->loadExists([
            'invoiceItems',
            'stockMovements as non_initial_stock_movements_exists' => function ($q) {
                $q->where('source_type', '!=', 'INITIAL');
            },
        ]);

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
        $product = Product::with(['category', 'stockMovements' => function ($q) {
            $q->latest()->limit(20);
        }])
        ->withExists([
            'invoiceItems',
            'stockMovements as non_initial_stock_movements_exists' => function ($q) {
                $q->where('source_type', '!=', 'INITIAL');
            },
        ])
        ->findOrFail($id);

        Gate::authorize('view', $product);

        return response()->json([
            'success' => true,
            'data' => new ProductResource($product),
        ]);
    }

    /**
     * تعديل بيانات الصنف
     */
    public function update(ProductRequest $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);
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
        $product = Product::findOrFail($id);
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
        $product = Product::findOrFail($id);
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
    public function recordOpeningBalance(Request $request): JsonResponse
    {
        Gate::authorize('create', Product::class);

        $validated = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.product_variant_id' => ['nullable', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.cost_price' => ['nullable', 'numeric', 'min:0'],
        ]);

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
}
