<?php

namespace App\Http\Controllers\Api\Easyfy;

use App\Enums\Easyfy\EasyfyStockMovementType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Easyfy\Admin\AdjustEasyfyStockRequest;
use App\Http\Resources\Easyfy\EasyfyVariantResource;
use App\Services\Easyfy\EasyfyStockService;
use Illuminate\Http\JsonResponse;

class AdminEasyfyInventoryController extends Controller
{
    public function __construct(private readonly EasyfyStockService $stockService) {}

    public function index(): JsonResponse
    {
        $overview = $this->stockService->getInventoryOverview();

        return response()->json([
            'success' => true,
            'data' => [
                'low_stock_count' => $overview['low_stock_count'],
                'variants' => EasyfyVariantResource::collection($overview['variants']),
            ],
        ]);
    }

    public function adjust(AdjustEasyfyStockRequest $request, int $variantId): JsonResponse
    {
        $data = $request->validated();
        $variant = $this->stockService->adjustStock(
            $request->user(),
            $variantId,
            EasyfyStockMovementType::from((string) $data['type']),
            (int) $data['quantity_delta'],
            isset($data['unit_cost']) ? (string) $data['unit_cost'] : null,
            $data['notes'] ?? null
        );

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث المخزون وتسجيل الحركة بنجاح.',
            'data' => new EasyfyVariantResource($variant),
        ]);
    }
}
