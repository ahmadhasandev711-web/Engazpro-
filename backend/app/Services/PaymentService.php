<?php

namespace App\Services;

use App\Contracts\PaymentHandlerInterface;
use App\Models\Party;
use App\Models\Payment;
use App\Models\User;
use App\Services\Payments\CardPaymentHandler;
use App\Services\Payments\CashPaymentHandler;
use App\Services\Payments\CreditPaymentHandler;
use App\Services\Payments\TransferPaymentHandler;
use App\Models\TreasuryTransaction;
use App\Enums\TreasuryTransactionType;
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

        return DB::transaction(function () use ($user, $data, $idempotencyKey) {
            $party = Party::where('user_id', $user->getAccountId())->findOrFail($data['party_id']);
            $type = $data['type']; // PAYMENT (دفع لمورد) or RECEIPT (قبض من عميل)
            $amountMoney = Money::of($data['amount']);
            $amount = $amountMoney->getAmount();
            $method = $data['method'] ?? 'CASH';
            $date = $data['date'] ?? now()->toDateString();
            $notes = $data['notes'] ?? null;

            // تحديد الوردية والخزينة
            $activeShift = $this->shiftService->getActiveShift($user);
            $treasury = $this->treasuryService->getTreasuryForUser($user);

            $payment = Payment::create([
                'user_id' => $user->getAccountId(),
                'created_by' => $user->id,
                'party_id' => $party->id,
                'invoice_id' => $data['invoice_id'] ?? null,
                'treasury_id' => $treasury->id,
                'shift_id' => $activeShift?->id,
                'idempotency_key' => $idempotencyKey,
                'type' => $type,
                'amount' => $amount,
                'method' => $method,
                'date' => $date,
                'notes' => $notes,
            ]);

            // تطبيق استراتيجية وسيلة الدفع (Strategy Pattern GR-8.1)
            $methodStr = $payment->method instanceof \BackedEnum ? $payment->method->value : (string) ($payment->method ?? $method);
            $this->resolveHandler($methodStr)->handle(
                $payment,
                $user,
                $party,
                $treasury,
                $activeShift
            );

            // تحديث الحسابات المالية الحية للوردية
            if ($activeShift) {
                $this->shiftService->syncShiftFinancials($activeShift);
            }

            // تسجيل القيد في كشف حساب الطرف (Ledger)
            // RECEIPT من عميل: دائن (Credit) لتخفيض مديونية العميل
            // PAYMENT لمورد: مدين (Debit) لتخفيض مستحقات المورد
            $debit = ($type === 'PAYMENT') ? $amount : 0;
            $credit = ($type === 'RECEIPT') ? $amount : 0;
            $docName = ($type === 'RECEIPT') ? 'سند قبض' : 'سند صرف';
            $desc = $notes ? "{$docName} - {$notes}" : "{$docName} رقم #{$payment->id}";

            $this->ledgerService->recordEntry(
                $user,
                $party,
                'PAYMENT',
                $payment->id,
                $payment->date->format('Y-m-d'),
                $desc,
                $debit,
                $credit
            );

            return $payment->load('party');
        });
    }

    /**
     * إلغاء السند وعكس أثره المحاسبي في كشف الحساب
     */
    public function deletePayment(User $user, int $id): void
    {
        DB::transaction(function () use ($user, $id) {
            $payment = Payment::where('user_id', $user->getAccountId())->findOrFail($id);
            $party = Party::where('user_id', $user->getAccountId())->findOrFail($payment->party_id);

            // عكس القيد المحاسبي
            // إذا كان RECEIPT (كان Credit)، نعكسه بـ Debit
            $isReceipt = $payment->isReceipt();
            $debit = $isReceipt ? $payment->amount : 0;
            $credit = !$isReceipt ? $payment->amount : 0;
            $docName = $isReceipt ? 'سند قبض' : 'سند صرف';

            $this->ledgerService->recordEntry(
                $user,
                $party,
                'REVERSAL',
                $payment->id,
                now()->toDateString(),
                "إلغاء {$docName} رقم #{$payment->id}",
                $debit,
                $credit
            );

            // عكس حركات الخزينة النقدية المرتبطة بالسند
            $treasuryTxns = TreasuryTransaction::where('user_id', $user->getAccountId())
                ->where('source_type', 'PAYMENT')
                ->where('source_id', $payment->id)
                ->get();

            foreach ($treasuryTxns as $txn) {
                $treasury = $txn->treasury;
                if ($treasury) {
                    $txnMoney = Money::of($txn->amount);
                    if ($txn->type === TreasuryTransactionType::DEPOSIT) {
                        $this->treasuryService->recordWithdrawal(
                            treasury: $treasury,
                            amount: $txnMoney,
                            sourceType: 'REVERSAL',
                            sourceId: $payment->id,
                            actor: $user,
                            notes: "إلغاء إيداع نقدي لسند قبض رقم #{$payment->id}",
                            shiftId: $txn->shift_id
                        );
                    } elseif ($txn->type === TreasuryTransactionType::WITHDRAWAL) {
                        $this->treasuryService->recordDeposit(
                            treasury: $treasury,
                            amount: $txnMoney,
                            sourceType: 'REVERSAL',
                            sourceId: $payment->id,
                            actor: $user,
                            notes: "إلغاء صرف نقدي لسند صرف رقم #{$payment->id}",
                            shiftId: $txn->shift_id
                        );
                    }
                }
            }

            $payment->delete();
        });
    }

    /**
     * استعلام قائمة السندات مع التصفية والصفحات
     */
    public function getPaymentsPaginated(User $user, array $filters = []): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $isEmployee = $user->isMandob() || $user->isCashier();

        $query = Payment::with(['party', 'invoice', 'creator'])
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id));

        if (!empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        if (!empty($filters['created_by'])) {
            if (!$isEmployee) {
                $query->where('created_by', $filters['created_by']);
            }
        }

        if (!empty($filters['party_id'])) {
            $query->where('party_id', $filters['party_id']);
        }

        if (!empty($filters['date_from'])) {
            $query->whereDate('date', '>=', $filters['date_from']);
        }
        if (!empty($filters['date_to'])) {
            $query->whereDate('date', '<=', $filters['date_to']);
        }

        $perPage = min((int) ($filters['per_page'] ?? 20), 100);
        return $query->latest()->paginate($perPage);
    }
}
