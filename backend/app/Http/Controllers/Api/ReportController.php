<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CashFlowTransactionsRequest;
use App\Http\Resources\CashFlowTransactionResource;
use App\Services\FinancialClosingService;
use App\Services\PurchaseReportService;
use App\Services\ReceivablesPayablesService;
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
            toDate: $request->input('to_date'),
            branchId: $request->filled('branch_id') ? (int) $request->input('branch_id') : null
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
            toDate: $request->input('to_date'),
            branchId: $request->filled('branch_id') ? (int) $request->input('branch_id') : null
        );

        return response()->json(['data' => $data]);
    }

    /**
     * تقرير تقييم المخزون والنواقص
     */
    public function stock(Request $request): JsonResponse
    {
        Gate::authorize('view-stock');

        $data = $this->reportService->getStockReport(
            user: $request->user(),
            search: $request->input('search'),
            perPage: (int) $request->input('per_page', 50),
            page: (int) $request->input('page', 1),
            branchId: $request->filled('branch_id') ? (int) $request->input('branch_id') : null
        );

        return response()->json(['data' => $data]);
    }

    /**
     * تقرير المشتريات والموردين والأصناف الأكثر شراءً
     */
    public function purchases(Request $request, PurchaseReportService $purchaseReportService): JsonResponse
    {
        Gate::authorize('view-purchases');

        $data = $purchaseReportService->getPurchaseReport(
            user: $request->user(),
            fromDate: $request->input('from_date'),
            toDate: $request->input('to_date'),
            branchId: $request->filled('branch_id') ? (int) $request->input('branch_id') : null
        );

        return response()->json(['data' => $data]);
    }

    /**
     * تقرير الخزينة ومتابعة الخزن الثلاث وحركة الوارد والصادر
     */
    public function cashFlow(Request $request): JsonResponse
    {
        Gate::authorize('view-cash-flow');

        $data = $this->reportService->getCashFlowReport(
            user: $request->user(),
            fromDate: $request->input('from_date'),
            toDate: $request->input('to_date'),
            branchId: $request->filled('branch_id') ? (int) $request->input('branch_id') : null
        );

        return response()->json(['data' => $data]);
    }

    /**
     * سجل الحركات التفصيلي لخزينة / قناة دفع محددة
     */
    public function cashFlowTransactions(CashFlowTransactionsRequest $request): JsonResponse
    {
        Gate::authorize('view-cash-flow');

        $validated = $request->validated();
        $paginator = $this->reportService->getCashFlowTransactions(
            channel: strtoupper($validated['channel']),
            filters: $validated,
            user: $request->user()
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

    public function financialClosing(Request $request, FinancialClosingService $closingService): JsonResponse
    {
        Gate::authorize('view-profit');

        $data = $closingService->getClosingStatements(
            user: $request->user(),
            fromDate: $request->input('from_date'),
            toDate: $request->input('to_date'),
            branchId: $request->filled('branch_id') ? (int) $request->input('branch_id') : null
        );

        return response()->json(['data' => $data]);
    }

    public function receivablesPayables(Request $request, ReceivablesPayablesService $agingService): JsonResponse
    {
        Gate::authorize('view-receivables-payables');

        return response()->json(['data' => $agingService->getSummary($request->user())]);
    }
}
