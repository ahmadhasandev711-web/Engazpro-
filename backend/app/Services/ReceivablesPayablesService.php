<?php

namespace App\Services;

use App\Enums\PartyType;
use App\Models\LedgerEntry;
use App\Models\Party;
use App\Models\User;
use App\Support\Money;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ReceivablesPayablesService
{
    public function getSummary(User $user): array
    {
        $accountId = $user->getAccountId();
        $openParties = Party::where('user_id', $accountId)
            ->where('balance', '!=', 0)
            ->orderByRaw('ABS(balance) DESC')
            ->get(['id', 'type', 'name', 'phone', 'balance', 'updated_at']);

        $lastActivityDates = $this->fetchLastActivityDates($accountId, $openParties->pluck('id')->all());
        $now = Carbon::now();

        $grouped = $this->groupWithAging($openParties, $lastActivityDates, $now);

        return [
            'as_of' => $now->toIso8601String(),
            'summary' => $this->buildTotalsSummary($grouped),
            'aging' => [
                'customers' => $this->sumAgingBuckets($grouped[PartyType::CUSTOMER->value] ?? collect()),
                'suppliers' => $this->sumAgingBuckets($grouped[PartyType::SUPPLIER->value] ?? collect()),
                'couriers' => $this->sumAgingBuckets($grouped[PartyType::COURIER->value] ?? collect()),
            ],
            'top_customers' => $this->sliceTop($grouped[PartyType::CUSTOMER->value] ?? collect()),
            'top_suppliers' => $this->sliceTop($grouped[PartyType::SUPPLIER->value] ?? collect()),
            'top_couriers' => $this->sliceTop($grouped[PartyType::COURIER->value] ?? collect()),
        ];
    }

    private function fetchLastActivityDates(int $accountId, array $partyIds): array
    {
        if (empty($partyIds)) {
            return [];
        }

        return LedgerEntry::withoutGlobalScopes()
            ->where('user_id', $accountId)
            ->whereIn('party_id', $partyIds)
            ->selectRaw('party_id, MAX(date) as last_date')
            ->groupBy('party_id')
            ->pluck('last_date', 'party_id')
            ->all();
    }

    private function groupWithAging(Collection $parties, array $lastDates, Carbon $now): array
    {
        $grouped = [];
        foreach ($parties as $party) {
            $type = $party->type instanceof \BackedEnum ? $party->type->value : (string) $party->type;
            $rawDate = $lastDates[$party->id] ?? $party->updated_at?->toDateString();
            $days = $rawDate ? max(0, (int) Carbon::parse($rawDate)->diffInDays($now)) : null;

            $grouped[$type][] = [
                'id' => $party->id,
                'name' => $party->name,
                'phone' => $party->phone,
                'type' => $type,
                'balance' => Money::of($party->balance ?? 0)->getAmount(),
                'last_activity_date' => $rawDate ? Carbon::parse($rawDate)->toDateString() : null,
                'days_since_activity' => $days,
                'aging_bucket' => $this->resolveAgingBucket($days),
            ];
        }

        return array_map(fn (array $rows) => collect($rows), $grouped);
    }

    private function resolveAgingBucket(?int $days): string
    {
        if ($days !== null && $days > 60) {
            return 'DAYS_60_PLUS';
        }
        if ($days !== null && $days > 30) {
            return 'DAYS_31_60';
        }

        return 'CURRENT';
    }

    private function sumAgingBuckets(Collection $rows): array
    {
        $current = Money::zero();
        $mid = Money::zero();
        $old = Money::zero();

        foreach ($rows as $row) {
            $bal = Money::of($row['balance'] ?? 0);
            if (!$bal->isPositive()) {
                continue;
            }
            if ($row['aging_bucket'] === 'DAYS_60_PLUS') {
                $old = $old->add($bal);
            } elseif ($row['aging_bucket'] === 'DAYS_31_60') {
                $mid = $mid->add($bal);
            } else {
                $current = $current->add($bal);
            }
        }

        return ['current_0_30' => $current->getAmount(), 'days_31_60' => $mid->getAmount(), 'days_60_plus' => $old->getAmount()];
    }

    private function sliceTop(Collection $rows): array
    {
        return $rows->take(15)->values()->all();
    }

    private function buildTotalsSummary(array $grouped): array
    {
        [$custRec, $custCred] = $this->splitPosNeg($grouped[PartyType::CUSTOMER->value] ?? collect());
        [$suppPay, $suppAdv] = $this->splitPosNeg($grouped[PartyType::SUPPLIER->value] ?? collect());
        [$courRec, $courPay] = $this->splitPosNeg($grouped[PartyType::COURIER->value] ?? collect());

        $netTrade = $custRec->add($courRec)->add($suppAdv)->subtract($suppPay)->subtract($custCred)->subtract($courPay);

        return [
            'customer_receivables_total' => $custRec->getAmount(),
            'customer_credits_total' => $custCred->getAmount(),
            'supplier_payables_total' => $suppPay->getAmount(),
            'supplier_advances_total' => $suppAdv->getAmount(),
            'courier_receivables_total' => $courRec->getAmount(),
            'courier_payables_total' => $courPay->getAmount(),
            'net_trade_position' => $netTrade->getAmount(),
        ];
    }

    /**
     * @return array{0: Money, 1: Money}
     */
    private function splitPosNeg(Collection $rows): array
    {
        $pos = Money::zero();
        $neg = Money::zero();
        foreach ($rows as $row) {
            $bal = Money::of($row['balance'] ?? 0);
            if ($bal->isPositive()) {
                $pos = $pos->add($bal);
            } elseif ($bal->isNegative()) {
                $neg = $neg->add(abs($bal->getAmount()));
            }
        }

        return [$pos, $neg];
    }
}
