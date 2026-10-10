<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ShiftResource;
use App\Http\Resources\TreasuryTransactionResource;
use App\Models\Shift;
use App\Services\ShiftService;
use Exception;
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
            openingBalance: (float) ($validated['opening_balance'] ?? 0),
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
    public function close(Request $request): JsonResponse
    {
        $user = $request->user();
        $activeShift = $this->shiftService->getActiveShift($user);

        if (!$activeShift) {
            return response()->json([
                'success' => false,
                'message' => 'لا توجد وردية مفتوحة حالياً لتقفيلها',
            ], 422);
        }

        $validated = $request->validate([
            'actual_cash' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'actual_cash.required' => 'يرجى إدخال المبلغ الفعلي الموجود في الدرج / العهدة',
            'actual_cash.min' => 'المبلغ الفعلي لا يمكن أن يكون سالباً',
        ]);

        $shift = $this->shiftService->closeShift(
            shift: $activeShift,
            actualCash: (float) $validated['actual_cash'],
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
        $user = $request->user();
        $accountId = $user->getAccountId();

        $query = Shift::withoutGlobalScopes()
            ->where('user_id', $accountId)
            ->with(['creator', 'treasury', 'settledByUser'])
            ->latest('id');

        // الموظف العادي يرى وردياته فقط
        if ($user->isMandob() || $user->isCashier()) {
            $query->where('created_by', $user->id);
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        if ($createdBy = $request->input('created_by')) {
            if (!$user->isMandob() && !$user->isCashier()) {
                $query->where('created_by', $createdBy);
            }
        }

        if ($date = $request->input('date')) {
            $query->whereDate('opened_at', $date);
        }

        $perPage = min((int) $request->input('per_page', 20), 100);
        $shifts = $query->paginate($perPage);

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
        $accountId = $user->getAccountId();

        $shift = Shift::withoutGlobalScopes()
            ->where('user_id', $accountId)
            ->with(['creator', 'treasury', 'settledByUser', 'invoices.party', 'payments.party', 'expenseRecords'])
            ->findOrFail($id);

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
    public function settle(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (!$user->canSettleShifts()) {
            return response()->json([
                'success' => false,
                'message' => 'عذراً، هذا الإجراء مخصص للمالك أو مدير الفرع أو مشرف الورديات فقط',
            ], 403);
        }

        $accountId = $user->getAccountId();
        $shift = Shift::withoutGlobalScopes()
            ->where('user_id', $accountId)
            ->with(['treasury', 'creator'])
            ->findOrFail($id);

        $validated = $request->validate([
            'target_treasury_id' => ['nullable', 'integer'],
            'settlement_notes' => ['nullable', 'string', 'max:500'],
        ]);

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
