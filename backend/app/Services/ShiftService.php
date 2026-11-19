<?php

namespace App\Services;

use App\Enums\DocumentType;
use App\Enums\InvoiceType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentType;
use App\Enums\ShiftStatus;
use App\Enums\TreasuryTransactionType;
use App\Exceptions\ShiftDomainException;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Shift;
use App\Models\Treasury;
use App\Models\TreasuryTransaction;
use App\Models\User;
use App\Services\DocumentSequenceService;
use App\Support\Money;
use Carbon\Carbon;
use Exception;
use Illuminate\Support\Facades\DB;

class ShiftService
{
    public function __construct(
        protected TreasuryService $treasuryService,
        protected ?DocumentSequenceService $sequenceService = null
    ) {
        $this->sequenceService ??= app(DocumentSequenceService::class);
    }

    /**
     * استرجاع الوردية المفتوحة حالياً للمستخدم (كاشير أو مندوب)
     */
    public function getActiveShift(User $user): ?Shift
    {
        return Shift::withoutGlobalScopes()
            ->where('created_by', $user->id)
            ->where('status', ShiftStatus::OPEN)
            ->latest('id')
            ->first();
    }

    /**
     * فتح وردية / عهدة عمل جديدة للموظف
     */
    public function openShift(User $user, float $openingBalance = 0.00, ?string $notes = null): Shift
    {
        if ($active = $this->getActiveShift($user)) {
            throw new ShiftDomainException('لديك وردية مفتوحة بالفعل برقم ' . $active->shift_number . '، يجب تقفيلها أولاً قبل بدء وردية جديدة.', 'SHIFT_ALREADY_OPEN');
        }

        return DB::transaction(fn() => $this->persistOpenedShift($user, $openingBalance, $notes));
    }

    private function persistOpenedShift(User $user, float $openingBalance, ?string $notes): Shift
    {
        $accountId = $user->getAccountId();
        $treasury = $this->treasuryService->getTreasuryForUser($user);
        $shiftNumber = 'SH-' . str_pad((string) $this->sequenceService->next($accountId, DocumentType::SHIFT), 5, '0', STR_PAD_LEFT);
        $openingMoney = Money::of($openingBalance);

        $shift = Shift::create([
            'user_id' => $accountId,
            'created_by' => $user->id,
            'treasury_id' => $treasury->id,
            'shift_number' => $shiftNumber,
            'status' => ShiftStatus::OPEN,
            'opened_at' => Carbon::now(),
            'opening_balance' => $openingMoney->getAmount(),
            'cash_sales' => 0.00, 'electronic_sales' => 0.00, 'credit_sales' => 0.00,
            'cash_receipts' => 0.00, 'cash_returns' => 0.00, 'expenses' => 0.00,
            'expected_cash' => $openingMoney->getAmount(),
            'notes' => $notes,
        ]);

        if ($openingMoney->isPositive()) {
            $this->treasuryService->recordDeposit($treasury, $openingMoney, 'SHIFT_OPENING', $shift->id, $user, "رصيد افتتاحي للوردية {$shiftNumber}", $shift->id);
        }

        return $shift;
    }

    /**
     * إعادة احتساب وتحديث القيم المالية الحية للوردية باستخدام Money
     */
    public function syncShiftFinancials(Shift $shift): void
    {
        $shiftId = $shift->id;
        $cashSales = $this->sumShiftSalesByMethods($shiftId, [PaymentMethod::CASH->value]);
        $electronicSales = $this->sumShiftSalesByMethods($shiftId, [PaymentMethod::CARD->value, PaymentMethod::TRANSFER->value, PaymentMethod::INSTAPAY->value, PaymentMethod::VODAFONE_CASH->value]);
        $creditSales = Money::of(Invoice::withoutGlobalScopes()->where('shift_id', $shiftId)->where('type', InvoiceType::SALE)->sum('remaining_amount'));
        $cashReceipts = Money::of(Payment::withoutGlobalScopes()->where('shift_id', $shiftId)->where('type', PaymentType::RECEIPT->value)->where('method', PaymentMethod::CASH->value)->whereNull('invoice_id')->sum('amount'));
        $cashReturns = Money::of(Invoice::withoutGlobalScopes()->where('shift_id', $shiftId)->where('type', InvoiceType::SALE_RETURN)->sum('paid_amount'));
        $expenses = Money::of(Expense::withoutGlobalScopes()->where('shift_id', $shiftId)->sum('amount'));
        $expectedCash = Money::of($shift->opening_balance)->add($cashSales)->add($cashReceipts)->subtract($cashReturns)->subtract($expenses);

        $shift->update([
            'cash_sales' => $cashSales->getAmount(), 'electronic_sales' => $electronicSales->getAmount(),
            'credit_sales' => $creditSales->getAmount(), 'cash_receipts' => $cashReceipts->getAmount(),
            'cash_returns' => $cashReturns->getAmount(), 'expenses' => $expenses->getAmount(),
            'expected_cash' => $expectedCash->getAmount(),
        ]);
    }

    private function sumShiftSalesByMethods(int $shiftId, array $methods): Money
    {
        $direct = Invoice::withoutGlobalScopes()->where('shift_id', $shiftId)->where('type', InvoiceType::SALE)->whereIn('payment_method', $methods)->sum('paid_amount');
        $split = Payment::withoutGlobalScopes()->where('shift_id', $shiftId)->where('type', PaymentType::RECEIPT->value)->whereIn('method', $methods)
            ->whereHas('invoice', fn($q) => $q->where('payment_method', PaymentMethod::SPLIT->value))->sum('amount');

        return Money::of($direct)->add(Money::of($split));
    }

    /**
     * تقفيل الوردية وتسليم العهدة بواسطة الموظف (الكاشير أو المندوب)
     */
    public function closeShift(Shift $shift, float $actualCash, ?string $notes = null): Shift
    {
        if ($shift->status !== ShiftStatus::OPEN) {
            throw new ShiftDomainException('لا يمكن إغلاق هذه الوردية لأنها ليست في حالة مفتوحة.', 'SHIFT_NOT_OPEN');
        }

        return DB::transaction(function () use ($shift, $actualCash, $notes) {
            $this->syncShiftFinancials($shift);
            $shift->refresh();

            $expectedMoney = Money::of($shift->expected_cash);
            $actualMoney = Money::of($actualCash);
            $diffMoney = $actualMoney->subtract($expectedMoney);

            $shift->update([
                'status' => ShiftStatus::CLOSED,
                'closed_at' => Carbon::now(),
                'actual_cash' => $actualMoney->getAmount(),
                'difference' => $diffMoney->getAmount(),
                'notes' => $notes ?: $shift->notes,
            ]);

            return $shift;
        });
    }

    /**
     * مراجعة وتأكيد استلام النقدية وتوريدها للخزينة الرئيسية (بواسطة المالك أو المدير أو المشرف)
     */
    public function settleAndHandover(
        Shift $shift,
        User $settledBy,
        ?int $targetTreasuryId = null,
        ?string $settlementNotes = null
    ): TreasuryTransaction {
        if (!$settledBy->canSettleShifts()) {
            throw new ShiftDomainException('غير مصرح لك باعتماد واستلام توريدات الخزينة.', 'UNAUTHORIZED_SETTLEMENT', 403);
        }
        if ($shift->status !== ShiftStatus::CLOSED) {
            throw new ShiftDomainException('يجب أن تكون الوردية مقفلة من قِبل الموظف قبل اعتماد استلامها.', 'SHIFT_NOT_CLOSED');
        }

        app(BranchScopeService::class)->assertCanAccessBranch(
            $settledBy,
            $shift->treasury?->branch_id ?? $shift->creator?->branch_id,
            'عذراً، يمكنك اعتماد واستلام ورديات فرعك فقط.'
        );

        return DB::transaction(fn() => $this->executeShiftHandover($shift, $settledBy, $targetTreasuryId, $settlementNotes));
    }

    private function executeShiftHandover(Shift $shift, User $settledBy, ?int $targetTreasuryId, ?string $settlementNotes): TreasuryTransaction
    {
        $targetTreasury = $this->resolveSettlementTargetTreasury($shift, $settledBy, $targetTreasuryId);
        $handoverAmount = Money::of($shift->actual_cash ?? $shift->expected_cash);
        $notes = "توريد عهدة رسمية للوردية {$shift->shift_number} من ({$shift->creator?->name}) إلى ({$targetTreasury->name}). " . ($settlementNotes ?? '');
        $transaction = $this->treasuryService->recordTransfer($shift->treasury, $targetTreasury, $handoverAmount, $settledBy, $notes, $shift->id, TreasuryTransactionType::HANDOVER);

        $shift->update(['status' => ShiftStatus::SETTLED, 'settled_at' => Carbon::now(), 'settled_by' => $settledBy->id, 'settlement_notes' => $settlementNotes]);

        return $transaction;
    }

    private function resolveSettlementTargetTreasury(Shift $shift, User $settledBy, ?int $targetTreasuryId): Treasury
    {
        if ($targetTreasuryId !== null) {
            $explicit = Treasury::where('user_id', $shift->user_id)->findOrFail($targetTreasuryId);
            if (!$settledBy->isOwnerOrAdmin() && !app(BranchScopeService::class)->canAccessTreasury($settledBy, $explicit)) {
                throw new ShiftDomainException('عذراً، لا تملك صلاحية التوريد إلى هذه الخزينة.', 'UNAUTHORIZED_TARGET_TREASURY', 403);
            }

            return $explicit;
        }

        $branchId = $shift->treasury?->branch_id ?? $shift->creator?->branch_id;

        return $branchId
            ? $this->treasuryService->getBranchTreasury($branchId, $shift->user_id)
            : $this->treasuryService->getMainTreasury($shift->user_id);
    }

    /**
     * استعلام قائمة الورديات مع الفلترة بالتاريخ والحالة والصفحات (متوافق مع الفهارس)
     */
    public function getShiftsPaginated(User $user, array $filters = []): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $accountId = $user->getAccountId();
        $isEmployee = $user->isMandob() || $user->isCashier();

        $query = Shift::withoutGlobalScopes()
            ->where('user_id', $accountId)
            ->with(['creator', 'treasury', 'settledByUser'])
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when(!empty($filters['status']), fn($q) => $q->where('status', $filters['status']))
            ->when(!empty($filters['created_by']) && !$isEmployee, fn($q) => $q->where('created_by', $filters['created_by']))
            ->latest('id');

        app(BranchScopeService::class)->applyTreasuryOrCreatorBranchFilter($query, $user, 'treasury', 'creator', !empty($filters['branch_id']) ? (int) $filters['branch_id'] : null);
        $this->applyShiftDateFilters($query, $filters);

        return $query->paginate(min((int) ($filters['per_page'] ?? 20), 100));
    }

    private function applyShiftDateFilters($query, array $filters): void
    {
        if (!empty($filters['date'])) {
            $d = $filters['date'];
            $query->where('opened_at', '>=', "{$d} 00:00:00")->where('opened_at', '<=', "{$d} 23:59:59");
        }
        if (!empty($filters['date_from'])) {
            $query->where('opened_at', '>=', "{$filters['date_from']} 00:00:00");
        }
        if (!empty($filters['date_to'])) {
            $query->where('opened_at', '<=', "{$filters['date_to']} 23:59:59");
        }
    }

    public function findForShowOrFail(User $user, int $id): Shift
    {
        $shift = Shift::withoutGlobalScopes()
            ->where('user_id', $user->getAccountId())
            ->with(['creator', 'treasury', 'settledByUser', 'invoices.party', 'payments.party', 'expenseRecords'])
            ->findOrFail($id);

        if (!$user->isMandob() && !$user->isCashier()) {
            app(BranchScopeService::class)->assertCanAccessBranch(
                $user,
                $shift->treasury?->branch_id ?? $shift->creator?->branch_id,
                'غير مصرح لك بالاطلاع على ورديات فروع أخرى'
            );
        }

        return $shift;
    }

    public function findForSettleOrFail(User $user, int $id): Shift
    {
        return Shift::withoutGlobalScopes()
            ->where('user_id', $user->getAccountId())
            ->with(['treasury', 'creator'])
            ->findOrFail($id);
    }
}
