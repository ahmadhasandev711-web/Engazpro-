<?php

namespace App\Services;

use App\Enums\DocumentType;
use App\Enums\InvoiceType;
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
        $active = $this->getActiveShift($user);
        if ($active) {
            throw new ShiftDomainException('لديك وردية مفتوحة بالفعل برقم ' . $active->shift_number . '، يجب تقفيلها أولاً قبل بدء وردية جديدة.', 'SHIFT_ALREADY_OPEN');
        }

        $accountId = $user->getAccountId();
        $treasury = $this->treasuryService->getTreasuryForUser($user);

        return DB::transaction(function () use ($user, $accountId, $treasury, $openingBalance, $notes) {
            $seq = $this->sequenceService->next($accountId, DocumentType::SHIFT);
            $shiftNumber = 'SH-' . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);

            $openingMoney = Money::of($openingBalance);

            $shift = Shift::create([
                'user_id' => $accountId,
                'created_by' => $user->id,
                'treasury_id' => $treasury->id,
                'shift_number' => $shiftNumber,
                'status' => ShiftStatus::OPEN,
                'opened_at' => Carbon::now(),
                'opening_balance' => $openingMoney->getAmount(),
                'cash_sales' => 0.00,
                'electronic_sales' => 0.00,
                'credit_sales' => 0.00,
                'cash_receipts' => 0.00,
                'cash_returns' => 0.00,
                'expenses' => 0.00,
                'expected_cash' => $openingMoney->getAmount(),
                'notes' => $notes,
            ]);

            // إذا كان هناك رصيد افتتاحي (فكة الدرج أو سلفة المندوب) نسجله إيداع في درج/عهدة الموظف
            if ($openingMoney->isPositive()) {
                $this->treasuryService->recordDeposit(
                    treasury: $treasury,
                    amount: $openingMoney,
                    sourceType: 'SHIFT_OPENING',
                    sourceId: $shift->id,
                    actor: $user,
                    notes: "رصيد افتتاحي للوردية {$shiftNumber}",
                    shiftId: $shift->id
                );
            }

            return $shift;
        });
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
            ->where('payment_method', 'CASH')
            ->sum('paid_amount');

        $cashSalesSplit = Payment::withoutGlobalScopes()
            ->where('shift_id', $shiftId)
            ->where('type', 'RECEIPT')
            ->where('method', 'CASH')
            ->whereHas('invoice', fn($q) => $q->where('payment_method', 'SPLIT'))
            ->sum('amount');

        $cashSales = Money::of($cashSalesDirect)->add(Money::of($cashSalesSplit));

        // مبيعات البطاقة والتحويل وإنستاباي وفودافون كاش (المباشرة والمجزأة)
        $electronicDirect = Invoice::withoutGlobalScopes()
            ->where('shift_id', $shiftId)
            ->where('type', InvoiceType::SALE)
            ->whereIn('payment_method', ['CARD', 'TRANSFER', 'INSTAPAY', 'VODAFONE_CASH'])
            ->sum('paid_amount');

        $electronicSplit = Payment::withoutGlobalScopes()
            ->where('shift_id', $shiftId)
            ->where('type', 'RECEIPT')
            ->whereIn('method', ['CARD', 'TRANSFER', 'INSTAPAY', 'VODAFONE_CASH'])
            ->whereHas('invoice', fn($q) => $q->where('payment_method', 'SPLIT'))
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
            ->where('type', 'RECEIPT')
            ->where('method', 'CASH')
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

        return DB::transaction(function () use ($shift, $settledBy, $targetTreasuryId, $settlementNotes) {
            $sourceTreasury = $shift->treasury;

            $targetTreasury = $targetTreasuryId
                ? Treasury::withoutGlobalScopes()->findOrFail($targetTreasuryId)
                : ($shift->creator?->branch_id
                    ? $this->treasuryService->getBranchTreasury($shift->creator->branch_id, $shift->user_id)
                    : $this->treasuryService->getMainTreasury($shift->user_id));

            // المبلغ الفعلي المسلم باليد
            $handoverAmount = Money::of($shift->actual_cash ?? $shift->expected_cash);

            // تحويل النقدية من عهدة/درج الموظف إلى الخزينة الرئيسية بسند توريد رسمي
            $transaction = $this->treasuryService->recordTransfer(
                fromTreasury: $sourceTreasury,
                toTreasury: $targetTreasury,
                amount: $handoverAmount,
                actor: $settledBy,
                notes: "توريد عهدة رسمية للوردية {$shift->shift_number} من ({$shift->creator?->name}) إلى ({$targetTreasury->name}). " . ($settlementNotes ?? ''),
                shiftId: $shift->id,
                type: TreasuryTransactionType::HANDOVER
            );

            // تحديث حالة الوردية إلى موردة ومستلمة رسمياً
            $shift->update([
                'status' => ShiftStatus::SETTLED,
                'settled_at' => Carbon::now(),
                'settled_by' => $settledBy->id,
                'settlement_notes' => $settlementNotes,
            ]);

            return $transaction;
        });
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
}
