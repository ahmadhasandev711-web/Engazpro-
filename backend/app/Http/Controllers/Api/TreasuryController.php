<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTreasuryRequest;
use App\Http\Requests\TransferTreasuryRequest;
use App\Http\Requests\UpdateTreasuryRequest;
use App\Http\Resources\TreasuryResource;
use App\Http\Resources\TreasuryTransactionResource;
use App\Models\Treasury;
use App\Services\TreasuryService;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TreasuryController extends Controller
{
    public function __construct(
        protected TreasuryService $treasuryService
    ) {}

    /**
     * استعراض قائمة الخزن والأرصدة
     */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Treasury::class);
        $branchId = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $forTransfer = $request->boolean('for_transfer');
        $treasuries = $this->treasuryService->getTreasuries($request->user(), $branchId, $forTransfer);

        return response()->json([
            'success' => true,
            'data' => TreasuryResource::collection($treasuries),
        ]);
    }

    /**
     * إنشاء خزينة جديدة أو حساب بنكي (صاحب العمل / المدير العام)
     */
    public function store(StoreTreasuryRequest $request): JsonResponse
    {
        $treasury = $this->treasuryService->createTreasury($request->validated(), $request->user());

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء الخزينة / الحساب بنجاح',
            'data' => new TreasuryResource($treasury),
        ], 201);
    }

    /**
     * تعديل بيانات الخزينة
     */
    public function update(UpdateTreasuryRequest $request, int $id): JsonResponse
    {
        $treasury = $this->treasuryService->findOrFail($id);
        Gate::authorize('update', $treasury);

        $updated = $this->treasuryService->updateTreasury($treasury, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث بيانات الخزينة بنجاح',
            'data' => new TreasuryResource($updated),
        ]);
    }

    /**
     * تفاصيل خزينة معينة
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $treasury = $this->treasuryService->findForShowOrFail($id);
        Gate::authorize('view', $treasury);

        return response()->json([
            'success' => true,
            'data' => new TreasuryResource($treasury),
        ]);
    }

    /**
     * كشف حركات الخزينة
     */
    public function transactions(Request $request, int $id): JsonResponse
    {
        $treasury = $this->treasuryService->findOrFail($id);
        Gate::authorize('viewTransactions', $treasury);

        $transactions = $this->treasuryService->getTransactionsPaginated($treasury, $request->all());

        return response()->json([
            'success' => true,
            'data' => TreasuryTransactionResource::collection($transactions),
            'meta' => [
                'current_page' => $transactions->currentPage(),
                'last_page' => $transactions->lastPage(),
                'per_page' => $transactions->perPage(),
                'total' => $transactions->total(),
            ],
        ]);
    }

    /**
     * تحويل نقدية يدوي بين خزنتين (صاحب العمل أو المدير)
     */
    public function transfer(TransferTreasuryRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $transaction = $this->treasuryService->transferBetweenTreasuries(
            actor: $request->user(),
            fromTreasuryId: (int) $validated['from_treasury_id'],
            toTreasuryId: (int) $validated['to_treasury_id'],
            amount: Money::of($validated['amount']),
            notes: $validated['notes'] ?? null
        );

        return response()->json([
            'success' => true,
            'message' => 'تم تحويل النقدية وتحديث الأرصدة بنجاح',
            'data' => new TreasuryTransactionResource($transaction),
        ]);
    }
}
