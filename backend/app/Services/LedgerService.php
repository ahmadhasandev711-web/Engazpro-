<?php

namespace App\Services;

use App\Enums\LedgerSource;
use App\Enums\PartyType;
use App\Models\LedgerEntry;
use App\Models\Party;
use App\Models\User;
use App\Support\Money;
use InvalidArgumentException;

class LedgerService
{
    /**
     * تسجيل حركة في كشف الحساب وتحديث رصيد الطرف بدقة متناهية
     */
    public function recordEntry(
        User $user,
        Party $party,
        LedgerSource|string $sourceType,
        ?int $sourceId,
        string $date,
        string $description,
        float $debit = 0.0,  // مدين (عليه)
        float $credit = 0.0  // دائن (له)
    ): LedgerEntry {
        if ($debit < 0 || $credit < 0) {
            throw new InvalidArgumentException('المبالغ المدينة والدائنة يجب أن تكون أكبر من أو تساوي صفراً.');
        }

        $debitMoney = Money::of($debit);
        $creditMoney = Money::of($credit);
        $lockedParty = Party::where('id', $party->id)->lockForUpdate()->first() ?? $party;
        $partyType = $lockedParty->type instanceof PartyType ? $lockedParty->type : PartyType::tryFrom((string) $lockedParty->type);

        $newBalance = $this->applyLedgerDelta($partyType, Money::of($lockedParty->balance), $debitMoney, $creditMoney)->getAmount();
        $lockedParty->update(['balance' => $newBalance]);
        $party->balance = $newBalance;

        return $this->persistLedgerEntry($user, $party, $sourceType, $sourceId, $date, $description, $debitMoney, $creditMoney, $newBalance);
    }

    private function persistLedgerEntry(
        User $user,
        Party $party,
        LedgerSource|string $sourceType,
        ?int $sourceId,
        string $date,
        string $description,
        Money $debitMoney,
        Money $creditMoney,
        float $balanceAfter
    ): LedgerEntry {
        return LedgerEntry::create([
            'user_id' => $user->getAccountId(),
            'party_id' => $party->id,
            'source_type' => $sourceType instanceof LedgerSource ? $sourceType->value : $sourceType,
            'source_id' => $sourceId,
            'date' => $date,
            'description' => $description,
            'debit' => $debitMoney->getAmount(),
            'credit' => $creditMoney->getAmount(),
            'balance_after' => $balanceAfter,
        ]);
    }

    /**
     * تدقيق وإعادة حساب رصيد الطرف من واقع سجل الحركات الفعلي (Audit & Recalculate)
     */
    public function auditAndRecalculateBalance(Party $party): float
    {
        $entries = LedgerEntry::where('party_id', $party->id)->orderBy('date', 'asc')->orderBy('id', 'asc')->get();
        $runningBalanceMoney = Money::zero();
        $partyType = $party->type instanceof PartyType ? $party->type : PartyType::tryFrom((string) $party->type);

        foreach ($entries as $entry) {
            $runningBalanceMoney = $this->applyLedgerDelta($partyType, $runningBalanceMoney, Money::of($entry->debit), Money::of($entry->credit));
            if ($entry->balance_after != $runningBalanceMoney->getAmount()) {
                $entry->update(['balance_after' => $runningBalanceMoney->getAmount()]);
            }
        }

        $calculatedBalance = $runningBalanceMoney->getAmount();
        if ($party->balance != $calculatedBalance) {
            $party->update(['balance' => $calculatedBalance]);
        }

        return $calculatedBalance;
    }

    private function applyLedgerDelta(?PartyType $partyType, Money $current, Money $debit, Money $credit): Money
    {
        if ($partyType === PartyType::CUSTOMER || $partyType === PartyType::COURIER) {
            return $current->add($debit)->subtract($credit);
        }

        return $current->add($credit)->subtract($debit);
    }

    /**
     * استخراج كشف حساب الطرف مع الحركات وإجمالي المدين والدائن
     */
    public function getStatement(User $user, Party $party, array $filters = []): array
    {
        $accountId = $user->getAccountId();
        $partyType = $party->type instanceof PartyType ? $party->type : PartyType::tryFrom((string) $party->type);
        $isCustomerOrCourier = ($partyType === PartyType::CUSTOMER || $partyType === PartyType::COURIER);
        $fromDate = !empty($filters['from_date']) ? substr($filters['from_date'], 0, 10) : null;
        $toDate = !empty($filters['to_date']) ? substr($filters['to_date'], 0, 10) : null;

        $periodQuery = LedgerEntry::where('user_id', $accountId)->where('party_id', $party->id)
            ->when($fromDate, fn($q) => $q->where('date', '>=', $fromDate))
            ->when($toDate, fn($q) => $q->where('date', '<=', $toDate));

        $totalsRow = (clone $periodQuery)->selectRaw('COALESCE(SUM(debit), 0) as total_debit, COALESCE(SUM(credit), 0) as total_credit, COUNT(*) as total_count')->first();
        $page = max(1, (int) ($filters['page'] ?? request()->input('page', 1)));
        $openingBalance = $this->computeBeforePeriodBalance($accountId, $party->id, $isCustomerOrCourier, $fromDate)
            ->add($this->computeOffsetBalance($periodQuery, $isCustomerOrCourier, ($page - 1) * 100));
        $paginator = (clone $periodQuery)->orderBy('date', 'asc')->orderBy('id', 'asc')->paginate(100, ['*'], 'page', $page);

        return $this->formatStatementPayload($party, $totalsRow, $openingBalance->getAmount(), $paginator);
    }

    private function computeBeforePeriodBalance(int $accountId, int $partyId, bool $isCustomerOrCourier, ?string $fromDate): Money
    {
        if (!$fromDate) {
            return Money::zero();
        }
        $row = LedgerEntry::where('user_id', $accountId)->where('party_id', $partyId)->where('date', '<', $fromDate)
            ->selectRaw('COALESCE(SUM(debit), 0) as sum_debit, COALESCE(SUM(credit), 0) as sum_credit')->first();

        return $this->netMovementBalance($isCustomerOrCourier, $row->sum_debit ?? 0, $row->sum_credit ?? 0);
    }

    private function computeOffsetBalance($periodQuery, bool $isCustomerOrCourier, int $offset): Money
    {
        if ($offset <= 0) {
            return Money::zero();
        }
        $offsetIds = (clone $periodQuery)->orderBy('date', 'asc')->orderBy('id', 'asc')->limit($offset)->pluck('id');
        $row = LedgerEntry::whereIn('id', $offsetIds)->selectRaw('COALESCE(SUM(debit), 0) as sum_debit, COALESCE(SUM(credit), 0) as sum_credit')->first();

        return $this->netMovementBalance($isCustomerOrCourier, $row->sum_debit ?? 0, $row->sum_credit ?? 0);
    }

    private function netMovementBalance(bool $isCustomerOrCourier, mixed $debit, mixed $credit): Money
    {
        $debitMoney = Money::of($debit);
        $creditMoney = Money::of($credit);

        return $isCustomerOrCourier ? $debitMoney->subtract($creditMoney) : $creditMoney->subtract($debitMoney);
    }

    private function formatStatementPayload(Party $party, object $totalsRow, float $openingBalance, $paginator): array
    {
        $currentBalance = Money::of($party->balance ?? 0)->getAmount();
        $meta = ['current_page' => $paginator->currentPage(), 'last_page' => $paginator->lastPage(), 'per_page' => $paginator->perPage(), 'total' => $paginator->total()];

        return [
            'party' => ['id' => $party->id, 'name' => $party->name, 'type' => $party->type, 'phone' => $party->phone, 'current_balance' => $currentBalance],
            'summary' => ['total_debit' => Money::of($totalsRow->total_debit ?? 0)->getAmount(), 'total_credit' => Money::of($totalsRow->total_credit ?? 0)->getAmount(), 'current_balance' => $currentBalance, 'opening_balance' => $openingBalance],
            'opening_balance' => $openingBalance,
            'entries' => $paginator->items(),
            'pagination' => $meta,
            'meta' => $meta,
        ];
    }

    /**
     * استرجاع كشف حساب الطرف التابع لحساب المنشأة
     */
    public function getStatementForPartyId(User $user, int $partyId, array $filters = []): array
    {
        $party = Party::where('user_id', $user->getAccountId())->findOrFail($partyId);

        return $this->getStatement($user, $party, $filters);
    }
}
