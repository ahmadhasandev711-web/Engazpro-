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
        $query = LedgerEntry::where('user_id', $user->getAccountId())
            ->where('party_id', $party->id);

        if (!empty($filters['from_date'])) {
            $query->whereDate('date', '>=', $filters['from_date']);
        }

        if (!empty($filters['to_date'])) {
            $query->whereDate('date', '<=', $filters['to_date']);
        }

        $entries = $query->orderBy('date', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $totalDebit = (float) $entries->sum('debit');
        $totalCredit = (float) $entries->sum('credit');

        return [
            'party' => [
                'id' => $party->id,
                'name' => $party->name,
                'type' => $party->type,
                'phone' => $party->phone,
                'current_balance' => (float) $party->balance,
            ],
            'summary' => [
                'total_debit' => $totalDebit,
                'total_credit' => $totalCredit,
                'current_balance' => (float) $party->balance,
            ],
            'entries' => $entries,
        ];
    }
}
