<?php

namespace App\Services;

use App\Contracts\PaymentHandlerInterface;
use App\Enums\LedgerSource;
use App\Enums\PaymentMethod;
use App\Enums\PaymentType;
use App\Enums\TreasuryTransactionType;
use App\Exceptions\PosDomainException;
use App\Models\Party;
use App\Models\Payment;
use App\Models\TreasuryTransaction;
use App\Models\User;
use App\Services\Payments\CardPaymentHandler;
use App\Services\Payments\CashPaymentHandler;
use App\Services\Payments\CreditPaymentHandler;
use App\Services\Payments\TransferPaymentHandler;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

class PaymentService
{
    /** @var PaymentHandlerInterface[] */
    protected array $handlers;

    public function __construct(
        protected LedgerService $ledgerService,
        protected ?TreasuryService $treasuryService = null,
        protected ?ShiftService $shiftService = null,
        ?iterable $handlers = null
    ) {
        $this->treasuryService ??= app(TreasuryService::class);
        $this->shiftService ??= app(ShiftService::class);
        $this->handlers = $handlers ? iterator_to_array($handlers) : [
            app(CashPaymentHandler::class),
            app(CardPaymentHandler::class),
            app(TransferPaymentHandler::class),
            app(CreditPaymentHandler::class),
        ];
    }

    public function resolveHandler(string $method): PaymentHandlerInterface
    {
        foreach ($this->handlers as $handler) {
            if ($handler->supports($method)) {
                return $handler;
            }
        }
        return app(CashPaymentHandler::class);
    }

    /**
     * إنشاء سند قبض أو صرف وتسجيل الأثر المحاسبي في كشف الحساب ذرياً
     */
    public function createPayment(User $user, array $data): Payment
    {
        $idempotencyKey = $data['idempotency_key'] ?? null;
        if (!empty($idempotencyKey)) {
            $existing = Payment::where('user_id', $user->getAccountId())
                ->where('idempotency_key', $idempotencyKey)
                ->first();
            if ($existing) {
                return $existing->load(['party', 'invoice']);
            }
        }

        return DB::transaction(fn() => $this->persistAndProcessPayment($user, $data, $idempotencyKey));
    }

    private function persistAndProcessPayment(User $user, array $data, ?string $idempotencyKey): Payment
    {
        $party = Party::where('user_id', $user->getAccountId())->findOrFail($data['party_id']);
        $amount = Money::of($data['amount'])->getAmount();
        $method = $data['method'] ?? PaymentMethod::CASH->value;
        $activeShift = $this->shiftService->getActiveShift($user);
        $treasury = $this->treasuryService->getTreasuryForUser($user);

        $payment = $this->createPaymentRecord($user, $party, $treasury, $activeShift, $data, $idempotencyKey, $amount, $method);
        $this->executePaymentStrategy($payment, $user, $party, $treasury, $activeShift, $method);
        $this->recordPaymentLedgerEntry($user, $party, $payment, $data['type'], $amount, $data['notes'] ?? null);

        return $payment->load('party');
    }

    private function createPaymentRecord(User $user, Party $party, $treasury, $activeShift, array $data, ?string $idempotencyKey, float $amount, string $method): Payment
    {
        return Payment::create([
            'user_id' => $user->getAccountId(),
            'created_by' => $user->id,
            'party_id' => $party->id,
            'invoice_id' => $data['invoice_id'] ?? null,
            'treasury_id' => $treasury->id,
            'shift_id' => $activeShift?->id,
            'idempotency_key' => $idempotencyKey,
            'type' => $data['type'],
            'amount' => $amount,
            'method' => $method,
            'date' => $data['date'] ?? now()->toDateString(),
            'notes' => $data['notes'] ?? null,
        ]);
    }

    private function executePaymentStrategy(Payment $payment, User $user, Party $party, $treasury, $activeShift, string $method): void
    {
        $methodStr = $payment->method instanceof \BackedEnum ? $payment->method->value : (string) ($payment->method ?? $method);
        $this->resolveHandler($methodStr)->handle($payment, $user, $party, $treasury, $activeShift);

        if ($activeShift) {
            $this->shiftService->syncShiftFinancials($activeShift);
        }
    }

    private function recordPaymentLedgerEntry(User $user, Party $party, Payment $payment, string $type, float $amount, ?string $notes): void
    {
        $debit = ($type === PaymentType::PAYMENT->value) ? $amount : 0;
        $credit = ($type === PaymentType::RECEIPT->value) ? $amount : 0;
        $docName = ($type === PaymentType::RECEIPT->value) ? 'سند قبض' : 'سند صرف';
        $desc = $notes ? "{$docName} - {$notes}" : "{$docName} رقم #{$payment->id}";

        $this->ledgerService->recordEntry($user, $party, LedgerSource::PAYMENT->value, $payment->id, $payment->date->format('Y-m-d'), $desc, $debit, $credit);
    }

    /**
     * إلغاء السند وعكس أثره المحاسبي في كشف الحساب
     */
    public function deletePayment(User $user, int $id): void
    {
        DB::transaction(function () use ($user, $id) {
            $payment = Payment::where('user_id', $user->getAccountId())->findOrFail($id);
            if ($payment->invoice_id !== null) {
                throw new PosDomainException(
                    'لا يمكن إلغاء سداد مرتبط بفاتورة من شاشة السندات؛ يرجى إلغاء الفاتورة نفسها للحفاظ على اتزان الحسابات.',
                    'INVOICE_PAYMENT_LOCKED',
                    422
                );
            }
            $party = Party::where('user_id', $user->getAccountId())->findOrFail($payment->party_id);

            $this->reversePaymentLedgerEntry($user, $party, $payment);
            $this->reversePaymentTreasuryTransactions($user, $payment);

            $payment->delete();
        });
    }

    private function reversePaymentLedgerEntry(User $user, Party $party, Payment $payment): void
    {
        $isReceipt = $payment->isReceipt();
        $debit = $isReceipt ? $payment->amount : 0;
        $credit = !$isReceipt ? $payment->amount : 0;
        $docName = $isReceipt ? 'سند قبض' : 'سند صرف';

        $this->ledgerService->recordEntry(
            $user,
            $party,
            LedgerSource::REVERSAL->value,
            $payment->id,
            now()->toDateString(),
            "إلغاء {$docName} رقم #{$payment->id}",
            $debit,
            $credit
        );
    }

    private function reversePaymentTreasuryTransactions(User $user, Payment $payment): void
    {
        $treasuryTxns = TreasuryTransaction::where('user_id', $user->getAccountId())
            ->where('source_type', LedgerSource::PAYMENT->value)
            ->where('source_id', $payment->id)
            ->get();

        foreach ($treasuryTxns as $txn) {
            $treasury = $txn->treasury;
            if (!$treasury) {
                continue;
            }
            $this->reverseSingleTreasuryTransaction($user, $payment, $treasury, $txn);
        }
    }

    private function reverseSingleTreasuryTransaction(User $user, Payment $payment, $treasury, TreasuryTransaction $txn): void
    {
        $txnMoney = Money::of($txn->amount);
        if ($txn->type === TreasuryTransactionType::DEPOSIT) {
            $this->treasuryService->recordWithdrawal($treasury, $txnMoney, LedgerSource::REVERSAL->value, $payment->id, $user, "إلغاء إيداع نقدي لسند قبض رقم #{$payment->id}", $txn->shift_id);
        } elseif ($txn->type === TreasuryTransactionType::WITHDRAWAL) {
            $this->treasuryService->recordDeposit($treasury, $txnMoney, LedgerSource::REVERSAL->value, $payment->id, $user, "إلغاء صرف نقدي لسند صرف رقم #{$payment->id}", $txn->shift_id);
        }
    }

    /**
     * بناء استعلام السندات المفلتر بشكل مركزي موحد (DRY)
     */
    protected function buildFilteredPaymentsQuery(User $user, array $filters = []): \Illuminate\Database\Eloquent\Builder
    {
        $isEmployee = $user->isMandob() || $user->isCashier();
        $query = Payment::query()
            ->whereNull('invoice_id')
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id));

        app(BranchScopeService::class)->applyTreasuryOrCreatorBranchFilter($query, $user, 'treasury', 'creator', !empty($filters['branch_id']) ? (int) $filters['branch_id'] : null);

        if (!empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }
        if (!empty($filters['created_by']) && !$isEmployee) {
            $query->where('created_by', $filters['created_by']);
        }
        if (!empty($filters['party_id'])) {
            $query->where('party_id', $filters['party_id']);
        }
        if (!empty($filters['search'])) {
            $this->applyPaymentSearchFilter($query, trim((string) $filters['search']));
        }
        if (!empty($filters['date_from'])) {
            $query->where('date', '>=', $filters['date_from']);
        }
        if (!empty($filters['date_to'])) {
            $query->where('date', '<=', $filters['date_to'] . ' 23:59:59');
        }

        return $query;
    }

    private function applyPaymentSearchFilter(\Illuminate\Database\Eloquent\Builder $query, string $search): void
    {
        $numericSearch = ltrim($search, '#');
        $query->where(function ($q) use ($search, $numericSearch) {
            if (is_numeric($numericSearch)) {
                $q->where('id', (int) $numericSearch)->orWhere('notes', 'like', "%{$search}%");
            } else {
                $q->where('notes', 'like', "%{$search}%");
            }
            $q->orWhereHas('party', fn($pq) => $pq->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"));
        });
    }

    /**
     * استعلام قائمة السندات مع التصفية والصفحات
     */
    public function getPaymentsPaginated(User $user, array $filters = []): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $perPage = min((int) ($filters['per_page'] ?? 20), 100);

        return $this->buildFilteredPaymentsQuery($user, $filters)
            ->with(['party', 'invoice', 'creator'])
            ->latest()
            ->paginate($perPage);
    }

    /**
     * حساب إجمالي سندات القبض والصرف للفترة المفلترة بدقة عبر كائن Money
     */
    public function getPaymentsSummary(User $user, array $filters = []): array
    {
        $baseQuery = $this->buildFilteredPaymentsQuery($user, $filters);

        $receiptsMoney = Money::of((clone $baseQuery)->where('type', PaymentType::RECEIPT->value)->sum('amount') ?? 0);
        $paymentsMoney = Money::of((clone $baseQuery)->where('type', PaymentType::PAYMENT->value)->sum('amount') ?? 0);

        return [
            'total_receipts' => $receiptsMoney->getAmount(),
            'total_payments' => $paymentsMoney->getAmount(),
        ];
    }

    public function findForShowOrFail(int $id): Payment
    {
        return Payment::with(['party', 'invoice', 'creator'])->findOrFail($id);
    }

    public function findOrFail(int $id): Payment
    {
        return Payment::findOrFail($id);
    }
}
