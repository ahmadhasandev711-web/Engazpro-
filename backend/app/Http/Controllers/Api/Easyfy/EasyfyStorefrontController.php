<?php

namespace App\Http\Controllers\Api\Easyfy;

use App\Http\Controllers\Controller;
use App\Http\Resources\Easyfy\EasyfyCategoryResource;
use App\Http\Resources\Easyfy\EasyfyProductResource;
use App\Http\Resources\Easyfy\EasyfyShippingZoneResource;
use App\Services\Easyfy\EasyfyCatalogQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EasyfyStorefrontController extends Controller
{
    public function __construct(private readonly EasyfyCatalogQueryService $catalogQuery) {}

    public function index(): JsonResponse
    {
        $data = $this->catalogQuery->getStorefrontData();

        return response()->json([
            'success' => true,
            'data' => [
                'settings' => $data['settings'],
                'categories' => EasyfyCategoryResource::collection($data['categories']),
                'featured_products' => EasyfyProductResource::collection($data['featured_products']),
                'shipping_zones' => EasyfyShippingZoneResource::collection($data['shipping_zones']),
            ],
        ]);
    }

    public function products(Request $request): JsonResponse
    {
        $products = $this->catalogQuery->paginateStorefrontProducts($request->only(['category_id', 'stock_mode', 'search', 'per_page']));

        return response()->json([
            'success' => true,
            'data' => EasyfyProductResource::collection($products),
            'meta' => [
                'current_page' => $products->currentPage(), 'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(), 'total' => $products->total(),
            ],
        ]);
    }

    public function showProduct(string $slugOrId): JsonResponse
    {
        $product = $this->catalogQuery->findStorefrontProductOrFail($slugOrId);

        return response()->json(['success' => true, 'data' => new EasyfyProductResource($product)]);
    }
}
