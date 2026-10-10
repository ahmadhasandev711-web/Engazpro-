<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StockTransferRequest;
use App\Models\StockTransfer;
use App\Services\StockTransferService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class StockTransferController extends Controller
{
    public function __construct(
        protected StockTransferService $transferService
    ) {}

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', StockTransfer::class);
        $transfers = $this->transferService->getTransfers($request->user(), $request->all());

        return response()->json([
            'success' => true,
            'data' => $transfers->items(),
            'meta' => [
                'current_page' => $transfers->currentPage(),
                'last_page' => $transfers->lastPage(),
                'total' => $transfers->total(),
            ],
        ]);
    }

    public function store(StockTransferRequest $request): JsonResponse
    {
        Gate::authorize('create', StockTransfer::class);
        $transfer = $this->transferService->createTransfer($request->user(), $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء أمر التحويل بنجاح وخروج البضاعة من فرع المصدر',
            'data' => $transfer,
        ], 201);
    }

    public function show(Request $request, StockTransfer $stockTransfer): JsonResponse
    {
        Gate::authorize('view', $stockTransfer);

        return response()->json([
            'success' => true,
            'data' => $stockTransfer->load(['fromBranch', 'toBranch', 'creator', 'receiver', 'items.product', 'items.variant']),
        ]);
    }

    public function receive(Request $request, StockTransfer $stockTransfer): JsonResponse
    {
        Gate::authorize('receive', $stockTransfer);

        $validated = $request->validate([
            'items' => 'nullable|array',
            'items.*.quantity_received' => 'nullable|numeric|gt:0',
        ]);

        $received = $this->transferService->receiveTransfer($request->user(), $stockTransfer, $validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تأكيد استلام التحويل وإيداع الأصناف في رصيد فرع الوجهة بنجاح',
            'data' => $received,
        ]);
    }

    public function cancel(Request $request, StockTransfer $stockTransfer): JsonResponse
    {
        Gate::authorize('cancel', $stockTransfer);

        $validated = $request->validate([
            'reason' => 'nullable|string|max:255',
        ]);

        $cancelled = $this->transferService->cancelTransfer($request->user(), $stockTransfer, $validated['reason'] ?? null);

        return response()->json([
            'success' => true,
            'message' => 'تم إلغاء أمر التحويل وإرجاع البضاعة لفرع المصدر بنجاح',
            'data' => $cancelled,
        ]);
    }
}
