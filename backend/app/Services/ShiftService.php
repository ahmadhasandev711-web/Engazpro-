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

        // مبيعات الكاش المباشرة + الأجزاء النقدية من الفواتير المجزأة
        $cashSalesDirect = Invoice::withoutGlobalScopes()
            ->where('shift_id', $shiftId)
            ->where('type', InvoiceType::SALE)
            ->where('payment_method', PaymentMethod::CASH->value)
            ->sum('paid_amount');

        $cashSalesSplit = Payment::withoutGlobalScopes()
            ->where('shift_id', $shiftId)
            ->where('type', PaymentType::RECEIPT->value)
            ->where('method', PaymentMethod::CASH->value)
            ->whereHas('invoice', fn($q) => $q->where('payment_method', PaymentMethod::SPLIT->value))
            ->sum('amount');

        $cashSales = Money::of($cashSalesDirect)->add(Money::of($cashSalesSplit));

        // مبيعات البطاقة والتحويل وإنستاباي وفودافون كاش (المباشرة والمجزأة)
        $electronicDirect = Invoice::withoutGlobalScopes()
            ->where('shift_id', $shiftId)
            ->where('type', InvoiceType::SALE)
            ->whereIn('payment_method', [PaymentMethod::CARD->value, PaymentMethod::TRANSFER->value, PaymentMethod::INSTAPAY->value, PaymentMethod::VODAFONE_CASH->value])
            ->sum('paid_amount');

        $electronicSplit = Payment::withoutGlobalScopes()
            ->where('shift_id', $shiftId)
            ->where('type', PaymentType::RECEIPT->value)
            ->whereIn('method', [PaymentMethod::CARD->value, PaymentMethod::TRANSFER->value, PaymentMethod::INSTAPAY->value, PaymentMethod::VODAFONE_CASH->value])
            ->whereHas('invoice', fn($q) => $q->where('payment_method', PaymentMethod::SPLIT->value))
            ->sum('amount');

        $electronicSales = Money::of($electronicDirect)->add(Money::of($electronicSplit));

        // مبيعات الآجل
        $creditSales = Money::of(Invoice::withoutGlobalScopes()
            ->where('shift_id', $shiftId)
            ->where('type', InvoiceType::SALE)
            ->sum('remaining_amount'));

        // سندات القبض النقدية الحرة غير المرتبطة بفاتورة مبيعات مباشرة
        $cashReceipts = Money::of(Payment::withoutGlobalScopes()
            ->where('shift_id', $shiftId)
            ->where('type', PaymentType::RECEIPT->value)
            ->where('method', PaymentMethod::CASH->value)
            ->whereNull('invoice_id')
            ->sum('amount'));

        // مرتجعات البيع المستردة نقداً
        $cashReturns = Money::of(Invoice::withoutGlobalScopes()
            ->where('shift_id', $shiftId)
            ->where('type', InvoiceType::SALE_RETURN)
            ->sum('paid_amount'));

        // مصروفات الوردية
        $expenses = Money::of(Expense::withoutGlobalScopes()
            ->where('shift_id', $shiftId)
            ->sum('amount'));

        $opening = Money::of($shift->opening_balance);

        // المعادلة المحاسبية الصافية للنقدية المتوقعة في الدرج/العهدة
        $expectedCash = $opening
            ->add($cashSales)
            ->add($cashReceipts)
            ->subtract($cashReturns)
            ->subtract($expenses);

        $shift->update([
            'cash_sales' => $cashSales->getAmount(),
            'electronic_sales' => $electronicSales->getAmount(),
            'credit_sales' => $creditSales->getAmount(),
            'cash_receipts' => $cashReceipts->getAmount(),
            'cash_returns' => $cashReturns->getAmount(),
            'expenses' => $expenses->getAmount(),
            'expected_cash' => $expectedCash->getAmount(),
        ]);
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

        return DB::transaction(fn() => $this->executeShiftHandover($shift, $settledBy, $targetTreasuryId, $settlementNotes));
    }

    private function executeShiftHandover(Shift $shift, User $settledBy, ?int $targetTreasuryId, ?string $settlementNotes): TreasuryTransaction
    {
        $targetTreasury = $targetTreasuryId
            ? Treasury::withoutGlobalScopes()->findOrFail($targetTreasuryId)
            : ($shift->creator?->branch_id
                ? $this->treasuryService->getBranchTreasury($shift->creator->branch_id, $shift->user_id)
                : $this->treasuryService->getMainTreasury($shift->user_id));

        $handoverAmount = Money::of($shift->actual_cash ?? $shift->expected_cash);
        $notes = "توريد عهدة رسمية للوردية {$shift->shift_number} من ({$shift->creator?->name}) إلى ({$targetTreasury->name}). " . ($settlementNotes ?? '');
        $transaction = $this->treasuryService->recordTransfer($shift->treasury, $targetTreasury, $handoverAmount, $settledBy, $notes, $shift->id, TreasuryTransactionType::HANDOVER);

        $shift->update(['status' => ShiftStatus::SETTLED, 'settled_at' => Carbon::now(), 'settled_by' => $settledBy->id, 'settlement_notes' => $settlementNotes]);

        return $transaction;
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

        if (!empty($filters['date'])) {
            $d = $filters['date'];
            $query->where('opened_at', '>=', "{$d} 00:00:00")
                  ->where('opened_at', '<=', "{$d} 23:59:59");
        }
        if (!empty($filters['date_from'])) {
            $query->where('opened_at', '>=', "{$filters['date_from']} 00:00:00");
        }
        if (!empty($filters['date_to'])) {
            $query->where('opened_at', '<=', "{$filters['date_to']} 23:59:59");
        }

        $perPage = min((int) ($filters['per_page'] ?? 20), 100);
        return $query->paginate($perPage);
    }

    public function findForShowOrFail(User $user, int $id): Shift
    {
        return Shift::withoutGlobalScopes()
            ->where('user_id', $user->getAccountId())
            ->with(['creator', 'treasury', 'settledByUser', 'invoices.party', 'payments.party', 'expenseRecords'])
            ->findOrFail($id);
    }

    public function findForSettleOrFail(User $user, int $id): Shift
    {
        return Shift::withoutGlobalScopes()
            ->where('user_id', $user->getAccountId())
            ->with(['treasury', 'creator'])
            ->findOrFail($id);
    }
}
