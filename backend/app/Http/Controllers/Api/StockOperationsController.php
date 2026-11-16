<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdjustStockRequest;
use App\Http\Resources\StockMovementResource;
use App\Services\StockAlertsService;
use App\Services\StockOperationsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class StockOperationsController extends Controller
{
    public function __construct(
        protected StockAlertsService $alertsService,
        protected StockOperationsService $operationsService
    ) {}

    public function alertsSummary(Request $request): JsonResponse
    {
        Gate::authorize('stock-alerts');

        return response()->json(['success' => true, 'data' => $this->alertsService->getSummary($request->user())]);
    }

    public function alerts(Request $request): JsonResponse
    {
        Gate::authorize('stock-alerts');

        return response()->json(['success' => true, 'data' => $this->alertsService->getAlerts($request->user(), $request->all())]);
    }

    public function adjust(AdjustStockRequest $request): JsonResponse
    {
        $result = $this->operationsService->adjustStock($request->user(), $request->validated());

        return response()->json([
            'success' => true,
            'message' => $result['message'],
            'data' => [
                'adjusted' => $result['adjusted'],
                'new_quantity' => $result['new_quantity'],
                'movement' => $result['movement'] ? new StockMovementResource($result['movement']) : null,
            ],
        ]);
    }

    public function movements(Request $request): JsonResponse
    {
        Gate::authorize('stock-movements');
        $paginator = $this->operationsService->getMovementsPaginated($request->user(), $request->all());

        return response()->json([
            'success' => true,
            'data' => StockMovementResource::collection($paginator),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }
}
