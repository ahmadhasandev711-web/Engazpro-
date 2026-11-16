<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CloseShiftRequest;
use App\Http\Requests\SettleShiftRequest;
use App\Http\Resources\ShiftResource;
use App\Http\Resources\TreasuryTransactionResource;
use App\Services\ShiftService;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShiftController extends Controller
{
    public function __construct(
        protected ShiftService $shiftService
    ) {}

    /**
     * جلب الوردية الحالية المفتوحة للموظف (كاشير / مندوب) مع مزامنة الأرقام الحية
     */
    public function active(Request $request): JsonResponse
    {
        $user = $request->user();
        $shift = $this->shiftService->getActiveShift($user);

        if ($shift) {
            // مزامنة الأرقام الحية قبل الإرجاع
            $this->shiftService->syncShiftFinancials($shift);
            $shift->refresh();
        }

        return response()->json([
            'success' => true,
            'data' => $shift ? new ShiftResource($shift) : null,
        ]);
    }

    /**
     * بدء وردية جديدة وتسجيل الرصيد الافتتاحي
     */
    public function open(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'opening_balance' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], [
            'opening_balance.min' => 'الرصيد الافتتاحي لا يمكن أن يكون سالباً',
        ]);

        $shift = $this->shiftService->openShift(
            user: $user,
            openingBalance: Money::of($validated['opening_balance'] ?? 0)->getAmount(),
            notes: $validated['notes'] ?? null
        );

        return response()->json([
            'success' => true,
            'message' => "تم فتح الوردية بنجاح برقم {$shift->shift_number}",
            'data' => new ShiftResource($shift),
        ], 201);
    }

    /**
     * تقفيل الوردية الحالية وتسجيل الجرد الفعلي للنقدية
     */
    public function close(CloseShiftRequest $request): JsonResponse
    {
        $activeShift = $this->shiftService->getActiveShift($request->user());
        if (!$activeShift) {
            return response()->json([
                'success' => false,
                'message' => 'لا توجد وردية مفتوحة حالياً لتقفيلها',
            ], 422);
        }

        $validated = $request->validated();
        $shift = $this->shiftService->closeShift(
            shift: $activeShift,
            actualCash: Money::of($validated['actual_cash'])->getAmount(),
            notes: $validated['notes'] ?? null
        );

        return response()->json([
            'success' => true,
            'message' => "تم تقفيل الوردية {$shift->shift_number} بنجاح، وهي الآن معلقة بانتظار استلام المشرف أو الإدارة",
            'data' => new ShiftResource($shift),
        ]);
    }

    /**
     * قائمة الورديات والعهد السابقة والمعلقة
     */
    public function index(Request $request): JsonResponse
    {
        $shifts = $this->shiftService->getShiftsPaginated($request->user(), $request->all());

        return response()->json([
            'success' => true,
            'data' => ShiftResource::collection($shifts),
            'meta' => [
                'current_page' => $shifts->currentPage(),
                'last_page' => $shifts->lastPage(),
                'per_page' => $shifts->perPage(),
                'total' => $shifts->total(),
            ],
        ]);
    }

    /**
     * تفاصيل وردية محددة
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $shift = $this->shiftService->findForShowOrFail($user, $id);

        if (($user->isMandob() || $user->isCashier()) && $shift->created_by !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'غير مصرح لك بالاطلاع على هذه الوردية',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => new ShiftResource($shift),
        ]);
    }

    /**
     * تأكيد استلام النقدية وتوريدها رسمياً للخزينة الرئيسية (صاحب العمل / المدير / المشرف)
     */
    public function settle(SettleShiftRequest $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->canSettleShifts()) {
            return response()->json([
                'success' => false,
                'message' => 'عذراً، هذا الإجراء مخصص للمالك أو مدير الفرع أو مشرف الورديات فقط',
            ], 403);
        }

        $shift = $this->shiftService->findForSettleOrFail($user, $id);
        $validated = $request->validated();
        $transaction = $this->shiftService->settleAndHandover(
            shift: $shift,
            settledBy: $user,
            targetTreasuryId: $validated['target_treasury_id'] ?? null,
            settlementNotes: $validated['settlement_notes'] ?? null
        );

        return response()->json([
            'success' => true,
            'message' => "تم تأكيد استلام عهدة الوردية {$shift->shift_number} وتوريد النقدية بنجاح إلى الخزينة الرئيسية",
            'data' => [
                'shift' => new ShiftResource($shift->fresh(['creator', 'treasury', 'settledByUser'])),
                'transaction' => new TreasuryTransactionResource($transaction),
            ],
        ]);
    }
}
