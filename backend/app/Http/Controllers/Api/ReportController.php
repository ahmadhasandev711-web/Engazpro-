<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CashFlowTransactionResource;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ReportController extends Controller
{
    public function __construct(
        protected ReportService $reportService
    ) {}

    /**
     * تقرير الأرباح الشامل (المبيعات، تكلفة البضاعة، إجمالي الربح، المصروفات، صافي الربح)
     */
    public function profit(Request $request): JsonResponse
    {
        Gate::authorize('view-profit');

        $data = $this->reportService->getProfitReport(
            fromDate: $request->input('from_date'),
            toDate: $request->input('to_date')
        );

        return response()->json(['data' => $data]);
    }

    /**
     * ملخص المبيعات وحركات النقدية
     */
    public function sales(Request $request): JsonResponse
    {
        Gate::authorize('view-sales');

        $data = $this->reportService->getSalesReport(
            user: $request->user(),
            fromDate: $request->input('from_date'),
            toDate: $request->input('to_date')
        );

        return response()->json(['data' => $data]);
    }

    /**
     * تقرير تقييم المخزون والنواقص
     */
    public function stock(Request $request): JsonResponse
    {
        Gate::authorize('view-stock');

        $data = $this->reportService->getStockReport($request->user());

        return response()->json(['data' => $data]);
    }

    /**
     * تقرير الخزينة ومتابعة الخزن الثلاث وحركة الوارد والصادر
     */
    public function cashFlow(Request $request): JsonResponse
    {
        Gate::authorize('view-cash-flow');

        $data = $this->reportService->getCashFlowReport(
            fromDate: $request->input('from_date'),
            toDate: $request->input('to_date')
        );

        return response()->json(['data' => $data]);
    }

    /**
     * سجل الحركات التفصيلي لخزينة / قناة دفع محددة
     */
    public function cashFlowTransactions(Request $request): JsonResponse
    {
        Gate::authorize('view-cash-flow');

        $validated = $request->validate([
            'channel' => ['required', 'string'],
            'from_date' => ['nullable', 'date'],
            'to_date' => ['nullable', 'date'],
            'flow_type' => ['nullable', 'string', 'in:ALL,INFLOW,OUTFLOW,all,inflow,outflow'],
            'movement_category' => ['nullable', 'string'],
            'search' => ['nullable', 'string', 'max:100'],
            'cashier_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $paginator = $this->reportService->getCashFlowTransactions(
            channel: strtoupper($validated['channel']),
            filters: $validated
        );

        return response()->json([
            'success' => true,
            'data' => CashFlowTransactionResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }
}
