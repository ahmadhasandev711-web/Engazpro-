<?php

namespace App\Services\Exchange;

use App\Enums\InvoiceType;
use App\Enums\StoreCreditTransactionType;
use App\Exceptions\PosDomainException;
use App\Models\Exchange;
use App\Models\Invoice;
use App\Models\Party;
use App\Models\StoreCreditTransaction;
use App\Models\User;
use App\Support\Money;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class StoreCreditService
{
    public function getValidBalance(User $user, Party $party): Money
    {
        if (empty($this->findExpiredEarnedIds($user->getAccountId(), $party->id))) {
            $raw = Money::of($party->store_credit_balance ?? 0);

            return $raw->isNegative() ? Money::zero() : $raw;
        }

        return DB::transaction(fn () => $this->expireAndRecomputeBalance($user, $party));
    }

    public function earnFromExchange(
        User $user,
        Party $party,
        Money $amount,
        Exchange $exchange,
        ?Carbon $expiresAt = null,
        ?string $notes = null
    ): StoreCreditTransaction {
        if (!$amount->isPositive()) {
            throw new PosDomainException('قيمة رصيد المحفظة المضاف يجب أن تكون أكبر من صفر.', 'INVALID_STORE_CREDIT_AMOUNT', 422);
        }

        return DB::transaction(fn () => $this->recordEarnedTransaction($user, $party, $amount, $exchange, $expiresAt, $notes));
    }

    private function recordEarnedTransaction(
        User $user,
        Party $party,
        Money $amount,
        Exchange $exchange,
        ?Carbon $expiresAt,
        ?string $notes
    ): StoreCreditTransaction {
        $locked = Party::where('user_id', $user->getAccountId())->lockForUpdate()->findOrFail($party->id);
        $newBalance = Money::of($locked->store_credit_balance ?? 0)->add($amount);
        $locked->update(['store_credit_balance' => $newBalance->getAmount()]);
        $party->store_credit_balance = $newBalance->getAmount();

        return StoreCreditTransaction::create([
            'user_id' => $user->getAccountId(), 'party_id' => $locked->id, 'created_by' => $user->id,
            'type' => StoreCreditTransactionType::EARNED, 'amount' => $amount->getAmount(),
            'remaining_amount' => $amount->getAmount(), 'balance_after' => $newBalance->getAmount(),
            'exchange_id' => $exchange->id, 'expires_at' => $expiresAt,
            'notes' => $notes ?: "رصيد استبدال {$exchange->exchange_number}",
        ]);
    }

    public function redeemForInvoice(
        User $user,
        int $partyId,
        Invoice $invoice,
        Money $amount,
        ?int $exchangeId = null
    ): StoreCreditTransaction {
        if (!$amount->isPositive()) {
            throw new PosDomainException('قيمة الخصم من رصيد المحفظة غير صالحة.', 'INVALID_STORE_CREDIT_AMOUNT', 422);
        }

        return DB::transaction(fn () => $this->executeRedeemTransaction($user, $partyId, $invoice, $amount, $exchangeId));
    }

    private function executeRedeemTransaction(User $user, int $partyId, Invoice $invoice, Money $amount, ?int $exchangeId): StoreCreditTransaction
    {
        $locked = Party::where('user_id', $user->getAccountId())->lockForUpdate()->findOrFail($partyId);
        $available = $this->expireAndRecomputeBalance($user, $locked);
        if ($amount->isGreaterThan($available)) {
            throw new PosDomainException("رصيد محفظة العميل المتاح ({$available->getAmount()}) غير كافٍ لسداد {$amount->getAmount()}.", 'INSUFFICIENT_STORE_CREDIT', 422);
        }

        $this->consumeEarnedBucketsFifo($user->getAccountId(), $locked->id, $amount);
        $diffBalance = $available->subtract($amount);
        $newBalance = $diffBalance->isNegative() ? Money::zero() : $diffBalance;
        $locked->update(['store_credit_balance' => $newBalance->getAmount()]);

        return StoreCreditTransaction::create([
            'user_id' => $user->getAccountId(), 'party_id' => $locked->id, 'created_by' => $user->id,
            'type' => StoreCreditTransactionType::REDEEMED, 'amount' => $amount->getAmount(),
            'balance_after' => $newBalance->getAmount(), 'exchange_id' => $exchangeId,
            'invoice_id' => $invoice->id, 'notes' => "استخدام رصيد محفظة في فاتورة {$invoice->invoice_number}",
        ]);
    }

    public function restoreRedemptionForInvoice(User $user, Invoice $invoice): void
    {
        if (!$invoice->party_id || ($invoice->type instanceof InvoiceType ? $invoice->type->value : (string) $invoice->type) !== InvoiceType::SALE->value) {
            return;
        }
        $redeemed = StoreCreditTransaction::where('user_id', $user->getAccountId())
            ->where('invoice_id', $invoice->id)
            ->where('type', StoreCreditTransactionType::REDEEMED->value)
            ->get();
        if ($redeemed->isEmpty()) {
            return;
        }

        $totalRestore = $redeemed->reduce(fn (Money $c, $tx) => $c->add(Money::of($tx->amount)), Money::zero());
        $locked = Party::where('user_id', $user->getAccountId())->lockForUpdate()->findOrFail($invoice->party_id);
        $newBalance = Money::of($locked->store_credit_balance ?? 0)->add($totalRestore);
        $locked->update(['store_credit_balance' => $newBalance->getAmount()]);

        StoreCreditTransaction::create([
            'user_id' => $user->getAccountId(), 'party_id' => $locked->id, 'created_by' => $user->id,
            'type' => StoreCreditTransactionType::ADJUSTMENT, 'amount' => $totalRestore->getAmount(),
            'remaining_amount' => $totalRestore->getAmount(), 'balance_after' => $newBalance->getAmount(),
            'invoice_id' => $invoice->id, 'notes' => "استرداد رصيد محفظة لإلغاء فاتورة {$invoice->invoice_number}",
        ]);
    }

    public function reverseExchangeCredit(User $user, Exchange $exchange): void
    {
        if (!$exchange->party_id) {
            return;
        }
        $accountId = $user->getAccountId();
        $locked = Party::where('user_id', $accountId)->lockForUpdate()->findOrFail($exchange->party_id);
        $current = $this->expireAndRecomputeBalance($user, $locked);
        $next = $this->revertEarnedForExchange($accountId, $locked, $exchange, $current);
        $next = $this->restoreUsedCreditForExchange($user, $locked, $exchange, $next);
        $locked->update(['store_credit_balance' => $next->getAmount()]);
    }

    public function getHistoryForParty(User $user, Party $party, int $perPage = 25): LengthAwarePaginator
    {
        return StoreCreditTransaction::where('user_id', $user->getAccountId())
            ->where('party_id', $party->id)
            ->with(['exchange:id,exchange_number', 'invoice:id,invoice_number', 'creator:id,name'])
            ->latest()
            ->paginate($perPage);
    }

    private function consumeEarnedBucketsFifo(int $accountId, int $partyId, Money $amountToConsume): void
    {
        $buckets = StoreCreditTransaction::where('user_id', $accountId)->where('party_id', $partyId)
            ->where('remaining_amount', '>', 0)
            ->orderByRaw('CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END ASC')
            ->orderBy('expires_at', 'asc')->orderBy('id', 'asc')->lockForUpdate()->get();

        $remainingNeeded = $amountToConsume;
        foreach ($buckets as $bucket) {
            if (!$remainingNeeded->isPositive()) {
                break;
            }
            $bucketAvail = Money::of($bucket->remaining_amount ?? 0);
            $take = $remainingNeeded->lessThan($bucketAvail) ? $remainingNeeded : $bucketAvail;
            $bucket->update(['remaining_amount' => $bucketAvail->subtract($take)->getAmount()]);
            $remainingNeeded = $remainingNeeded->subtract($take);
        }
    }

    private function findExpiredEarnedIds(int $accountId, int $partyId): array
    {
        return StoreCreditTransaction::where('user_id', $accountId)->where('party_id', $partyId)
            ->where('type', StoreCreditTransactionType::EARNED->value)
            ->where('remaining_amount', '>', 0)
            ->whereNotNull('expires_at')->where('expires_at', '<', now())->pluck('id')->all();
    }

    private function expireAndRecomputeBalance(User $user, Party $lockedParty): Money
    {
        $expired = StoreCreditTransaction::where('user_id', $user->getAccountId())->where('party_id', $lockedParty->id)
            ->where('type', StoreCreditTransactionType::EARNED->value)
            ->where('remaining_amount', '>', 0)
            ->whereNotNull('expires_at')->where('expires_at', '<', now())->lockForUpdate()->get();

        $current = Money::of($lockedParty->store_credit_balance ?? 0);
        if ($expired->isEmpty()) {
            return $current->isNegative() ? Money::zero() : $current;
        }
        $expiredSum = $expired->reduce(fn (Money $c, $tx) => $c->add(Money::of($tx->remaining_amount ?? 0)), Money::zero());
        $afterExpire = $current->subtract($expiredSum);
        $nextBalance = $afterExpire->isNegative() ? Money::zero() : $afterExpire;

        foreach ($expired as $tx) {
            $tx->update(['remaining_amount' => 0, 'expires_at' => null, 'notes' => trim(($tx->notes ? $tx->notes . ' ' : '') . '[منتهي الصلاحية]')]);
        }
        $lockedParty->update(['store_credit_balance' => $nextBalance->getAmount()]);

        return $nextBalance;
    }

    private function revertEarnedForExchange(int $accountId, Party $locked, Exchange $exchange, Money $current): Money
    {
        $earned = StoreCreditTransaction::where('user_id', $accountId)->where('exchange_id', $exchange->id)
            ->where('type', StoreCreditTransactionType::EARNED->value)->lockForUpdate()->get();
        if ($earned->isEmpty()) {
            return $current;
        }
        foreach ($earned as $tx) {
            $orig = Money::of($tx->amount);
            $rem = Money::of($tx->remaining_amount ?? $tx->amount);
            if ($rem->lessThan($orig) || $current->lessThan($orig)) {
                throw new PosDomainException('عذراً، العميل استخدم جزءاً من رصيد المحفظة الناتج عن هذا الاستبدال، لا يمكن إلغاء السند.', 'EXCHANGE_CREDIT_ALREADY_SPENT', 422);
            }
            $current = $current->subtract($orig);
            $tx->update(['remaining_amount' => 0, 'expires_at' => null, 'notes' => trim(($tx->notes ?? '') . ' [تم الإلغاء]')]);
        }
        $totalReverted = $earned->reduce(fn (Money $c, $tx) => $c->add(Money::of($tx->amount)), Money::zero());
        StoreCreditTransaction::create([
            'user_id' => $accountId, 'party_id' => $locked->id, 'exchange_id' => $exchange->id,
            'type' => StoreCreditTransactionType::ADJUSTMENT, 'amount' => -$totalReverted->getAmount(),
            'balance_after' => $current->getAmount(), 'notes' => "عكس إضافة محفظة لإلغاء {$exchange->exchange_number}",
        ]);

        return $current;
    }

    private function restoreUsedCreditForExchange(User $user, Party $locked, Exchange $exchange, Money $current): Money
    {
        $used = Money::of($exchange->store_credit_used ?? 0);
        if (!$used->isPositive()) {
            return $current;
        }
        $next = $current->add($used);
        StoreCreditTransaction::create([
            'user_id' => $user->getAccountId(), 'party_id' => $locked->id, 'created_by' => $user->id,
            'type' => StoreCreditTransactionType::ADJUSTMENT, 'amount' => $used->getAmount(),
            'remaining_amount' => $used->getAmount(), 'balance_after' => $next->getAmount(),
            'exchange_id' => $exchange->id, 'notes' => "استرداد رصيد مستهلك لإلغاء {$exchange->exchange_number}",
        ]);

        return $next;
    }
}
