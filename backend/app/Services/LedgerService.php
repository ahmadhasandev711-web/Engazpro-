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
        $sourceTypeValue = $sourceType instanceof LedgerSource ? $sourceType->value : $sourceType;
        if ($debit < 0 || $credit < 0) {
            throw new InvalidArgumentException('المبالغ المدينة والدائنة يجب أن تكون أكبر من أو تساوي صفراً.');
        }

        $debitMoney = Money::of($debit);
        $creditMoney = Money::of($credit);
        // قفل تشاؤمي لصف جهة التعامل لمنع تضارب التزامن (Lost Updates)
        $lockedParty = Party::where('id', $party->id)->lockForUpdate()->first() ?? $party;
        $currentBalanceMoney = Money::of($lockedParty->balance);

        $partyType = $lockedParty->type instanceof PartyType ? $lockedParty->type : PartyType::tryFrom((string) $lockedParty->type);

        // للعميل وشركة الشحن: المدين يزيد المديونية (مطلوب تحصيله) والدائن يقلله (سداد / توريد)
        // للمورد: الدائن يزيد ما له والمدين يقلله
        if ($partyType === PartyType::CUSTOMER || $partyType === PartyType::COURIER) {
            $newBalanceMoney = $currentBalanceMoney->add($debitMoney)->subtract($creditMoney);
        } else {
            $newBalanceMoney = $currentBalanceMoney->add($creditMoney)->subtract($debitMoney);
        }

        $newBalance = $newBalanceMoney->getAmount();
        $lockedParty->balance = $newBalance;
        $lockedParty->save();
        $party->balance = $newBalance;

        return LedgerEntry::create([
            'user_id' => $user->getAccountId(),
            'party_id' => $party->id,
            'source_type' => $sourceTypeValue,
            'source_id' => $sourceId,
            'date' => $date,
            'description' => $description,
            'debit' => $debitMoney->getAmount(),
            'credit' => $creditMoney->getAmount(),
            'balance_after' => $newBalance,
        ]);
    }

    /**
     * تدقيق وإعادة حساب رصيد الطرف من واقع سجل الحركات الفعلي (Audit & Recalculate)
     */
    public function auditAndRecalculateBalance(Party $party): float
    {
        $entries = LedgerEntry::where('party_id', $party->id)
            ->orderBy('date', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $runningBalanceMoney = Money::zero();

        $partyType = $party->type instanceof PartyType ? $party->type : PartyType::tryFrom((string) $party->type);

        foreach ($entries as $entry) {
            $debitMoney = Money::of($entry->debit);
            $creditMoney = Money::of($entry->credit);

            if ($partyType === PartyType::CUSTOMER || $partyType === PartyType::COURIER) {
                $runningBalanceMoney = $runningBalanceMoney->add($debitMoney)->subtract($creditMoney);
            } else {
                $runningBalanceMoney = $runningBalanceMoney->add($creditMoney)->subtract($debitMoney);
            }

            if ($entry->balance_after != $runningBalanceMoney->getAmount()) {
                $entry->balance_after = $runningBalanceMoney->getAmount();
                $entry->save();
            }
        }

        $calculatedBalance = $runningBalanceMoney->getAmount();
        if ($party->balance != $calculatedBalance) {
            $party->balance = $calculatedBalance;
            $party->save();
        }

        return $calculatedBalance;
    }

    /**
     * استخراج كشف حساب الطرف مع الحركات وإجمالي المدين والدائن
     */
    public function getStatement(User $user, Party $party, array $filters = []): array
    {
        $accountId = $user->getAccountId();
        $partyType = $party->type instanceof PartyType ? $party->type : PartyType::tryFrom((string) $party->type);
        $isCustomerOrCourier = ($partyType === PartyType::CUSTOMER || $partyType === PartyType::COURIER);

        $periodQuery = LedgerEntry::where('user_id', $accountId)
            ->where('party_id', $party->id);

        $fromDate = !empty($filters['from_date']) ? substr($filters['from_date'], 0, 10) : null;
        $toDate = !empty($filters['to_date']) ? substr($filters['to_date'], 0, 10) : null;

        if ($fromDate) {
            $periodQuery->where('date', '>=', $fromDate);
        }

        if ($toDate) {
            $periodQuery->where('date', '<=', $toDate);
        }

        // إجمالي المدين والدائن للفترة بـ SQL
        $totalsRow = (clone $periodQuery)->selectRaw('
            COALESCE(SUM(debit), 0) as total_debit,
            COALESCE(SUM(credit), 0) as total_credit,
            COUNT(*) as total_count
        ')->first();

        $totalDebit = Money::of($totalsRow->total_debit ?? 0)->getAmount();
        $totalCredit = Money::of($totalsRow->total_credit ?? 0)->getAmount();
        $currentBalance = Money::of($party->balance ?? 0)->getAmount();

        // 1. حساب الرصيد التراكمي السابق للفترة (كل ما قبل from_date)
        if ($fromDate) {
            $beforePeriodRow = LedgerEntry::where('user_id', $accountId)
                ->where('party_id', $party->id)
                ->where('date', '<', $fromDate)
                ->selectRaw('
                    COALESCE(SUM(debit), 0) as sum_debit,
                    COALESCE(SUM(credit), 0) as sum_credit
                ')->first();

            $priorDebit = Money::of($beforePeriodRow->sum_debit ?? 0);
            $priorCredit = Money::of($beforePeriodRow->sum_credit ?? 0);
            $beforePeriodBalance = $isCustomerOrCourier
                ? $priorDebit->subtract($priorCredit)
                : $priorCredit->subtract($priorDebit);
        } else {
            $beforePeriodBalance = Money::zero();
        }

        // 2. تقسيم الحركات بـ Pagination (100 لكل صفحة)
        $perPage = 100;
        $page = max(1, (int) ($filters['page'] ?? request()->input('page', 1)));
        $offset = ($page - 1) * $perPage;

        // 3. حساب الرصيد التراكمي للحركات السابقة للصفحة الحالية ضمن الفترة
        if ($offset > 0) {
            $offsetIds = (clone $periodQuery)->orderBy('date', 'asc')
                ->orderBy('id', 'asc')
                ->limit($offset)
                ->pluck('id');

            $offsetRow = LedgerEntry::whereIn('id', $offsetIds)->selectRaw('
                COALESCE(SUM(debit), 0) as sum_debit,
                COALESCE(SUM(credit), 0) as sum_credit
            ')->first();

            $offsetDebit = Money::of($offsetRow->sum_debit ?? 0);
            $offsetCredit = Money::of($offsetRow->sum_credit ?? 0);
            $offsetBalance = $isCustomerOrCourier
                ? $offsetDebit->subtract($offsetCredit)
                : $offsetCredit->subtract($offsetDebit);
        } else {
            $offsetBalance = Money::zero();
        }

        $openingBalance = $beforePeriodBalance->add($offsetBalance)->getAmount();

        $paginator = (clone $periodQuery)->orderBy('date', 'asc')
            ->orderBy('id', 'asc')
            ->paginate($perPage, ['*'], 'page', $page);

        return [
            'party' => [
                'id' => $party->id,
                'name' => $party->name,
                'type' => $party->type,
                'phone' => $party->phone,
                'current_balance' => $currentBalance,
            ],
            'summary' => [
                'total_debit' => $totalDebit,
                'total_credit' => $totalCredit,
                'current_balance' => $currentBalance,
                'opening_balance' => $openingBalance,
            ],
            'opening_balance' => $openingBalance,
            'entries' => $paginator->items(),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ];
    }
}
