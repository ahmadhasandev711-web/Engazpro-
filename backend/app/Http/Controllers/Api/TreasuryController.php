<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TreasuryResource;
use App\Http\Resources\TreasuryTransactionResource;
use App\Models\Treasury;
use App\Models\TreasuryTransaction;
use App\Services\TreasuryService;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
    public function store(Request $request): JsonResponse
    {
        \Illuminate\Support\Facades\Gate::authorize('create', Treasury::class);

        $accountId = $request->user()->getAccountId();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', 'string', 'in:MAIN,BRANCH_SAFE,CASHIER_DRAWER,MANDOB_CUSTODY,BANK,WALLET,OWNER_DRAWINGS'],
            'branch_id' => [
                'nullable',
                'integer',
                \Illuminate\Validation\Rule::exists('branches', 'id')->where('user_id', $accountId),
            ],
            'opening_balance' => ['nullable', 'numeric', 'min:0'],
            'assigned_user_id' => [
                'nullable',
                'integer',
                \Illuminate\Validation\Rule::exists('users', 'id')->where(function ($q) use ($accountId) {
                    $q->where('id', $accountId)->orWhere('owner_id', $accountId);
                }),
            ],
            'notes' => ['nullable', 'string', 'max:500'],
        ], [
            'name.required' => 'يجب إدخال اسم الخزينة أو الحساب',
            'type.required' => 'يجب تحديد نوع الخزينة',
            'type.in' => 'نوع الخزينة المحدد غير صالح',
        ]);

        $treasury = $this->treasuryService->createTreasury($validated, $request->user());

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء الخزينة / الحساب بنجاح',
            'data' => new TreasuryResource($treasury),
        ], 201);
    }

    /**
     * تعديل بيانات الخزينة
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $treasury = Treasury::findOrFail($id);
        \Illuminate\Support\Facades\Gate::authorize('update', $treasury);

        $accountId = $request->user()->getAccountId();

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:100'],
            'branch_id' => [
                'nullable',
                'integer',
                \Illuminate\Validation\Rule::exists('branches', 'id')->where('user_id', $accountId),
            ],
            'is_active' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $updated = $this->treasuryService->updateTreasury($treasury, $validated);

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
        $treasury = Treasury::with(['assignedUser', 'branch'])->findOrFail($id);
        \Illuminate\Support\Facades\Gate::authorize('view', $treasury);

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
        $treasury = Treasury::findOrFail($id);
        \Illuminate\Support\Facades\Gate::authorize('viewTransactions', $treasury);

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
    public function transfer(Request $request): JsonResponse
    {
        \Illuminate\Support\Facades\Gate::authorize('transfer', Treasury::class);

        $validated = $request->validate([
            'from_treasury_id' => ['required', 'integer', 'different:to_treasury_id'],
            'to_treasury_id' => ['required', 'integer'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], [
            'from_treasury_id.required' => 'يجب تحديد خزينة المصدر',
            'to_treasury_id.required' => 'يجب تحديد خزينة الوجهة',
            'from_treasury_id.different' => 'لا يمكن التحويل لنفس الخزينة',
            'amount.min' => 'المبلغ يجب أن يكون أكبر من صفر',
        ]);

        $from = Treasury::findOrFail($validated['from_treasury_id']);
        $to = Treasury::findOrFail($validated['to_treasury_id']);
        $user = $request->user();

        if ($user->isManager()) {
            if ($from->branch_id !== $user->branch_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'عذراً، يمكنك التحويل فقط من خزن فرعك التابع له.',
                ], 403);
            }
            $toType = $to->type instanceof \BackedEnum ? $to->type->value : (string) $to->type;
            $isAllowedDest = ($to->branch_id === $user->branch_id) || in_array($toType, ['BANK', 'MAIN']);
            if (!$isAllowedDest) {
                return response()->json([
                    'success' => false,
                    'message' => 'عذراً، يمكنك التوريد فقط إلى خزن فرعك، أو الحساب البنكي، أو الخزنة المركزية.',
                ], 403);
            }
        }

        $amountMoney = Money::of($validated['amount']);

        $transaction = $this->treasuryService->recordTransfer(
            fromTreasury: $from,
            toTreasury: $to,
            amount: $amountMoney,
            actor: $user,
            notes: $validated['notes'] ?? 'تحويل إداري بين الخزن'
        );

        return response()->json([
            'success' => true,
            'message' => 'تم تحويل النقدية وتحديث الأرصدة بنجاح',
            'data' => new TreasuryTransactionResource($transaction),
        ]);
    }
}
