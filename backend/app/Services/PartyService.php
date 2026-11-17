<?php

namespace App\Services;

use App\Enums\LedgerSource;
use App\Enums\PartyType;
use App\Exceptions\PosDomainException;
use App\Models\Party;
use App\Models\User;
use App\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class PartyService
{
    public function __construct(
        protected LedgerService $ledgerService
    ) {}

    /**
     * إنشاء عميل أو مورد جديد مع رصيد افتتاحي
     */
    public function createParty(User $user, array $data): Party
    {
        $initialBalance = Money::of($data['initial_balance'] ?? 0)->getAmount();

        return DB::transaction(function () use ($user, $data, $initialBalance) {
            $party = Party::create([
                'user_id' => $user->getAccountId(),
                'type' => $data['type'],
                'name' => $data['name'],
                'phone' => $data['phone'] ?? null,
                'phone2' => $data['phone2'] ?? null,
                'address' => $data['address'] ?? null,
                'notes' => $data['notes'] ?? null,
                'balance' => 0.00,
            ]);

            if ($initialBalance != 0.0) {
                $this->recordOpeningLedgerBalance($user, $party, $initialBalance);
            }

            return $party;
        });
    }

    private function recordOpeningLedgerBalance(User $user, Party $party, float $initialBalance): void
    {
        $isCustomer = $party->type === PartyType::CUSTOMER->value;
        $isPositive = $initialBalance > 0;
        $debit = ($isCustomer === $isPositive) ? abs($initialBalance) : 0.0;
        $credit = ($isCustomer !== $isPositive) ? abs($initialBalance) : 0.0;

        $this->ledgerService->recordEntry(
            $user,
            $party,
            LedgerSource::INITIAL->value,
            $party->id,
            now()->toDateString(),
            'رصيد افتتاحي عند إنشاء الحساب',
            $debit,
            $credit
        );
    }

    /**
     * تحديث بيانات الطرف
     */
    public function updateParty(Party $party, array $data): Party
    {
        unset($data['balance']);
        unset($data['initial_balance']);

        $party->update($data);
        return $party;
    }

    /**
     * حذف الطرف مع التحقق من عدم وجود فواتير أو رصيد
     */
    public function deleteParty(Party $party): bool
    {
        $hasInvoices = $party->invoices()->exists();
        $hasPayments = $party->payments()->exists();
        $hasBalance = !Money::of($party->balance ?? 0)->isZero();

        $typeArabic = PartyType::tryFrom($party->type)?->label() ?? 'الطرف';

        if ($hasInvoices || $hasPayments || $hasBalance) {
            throw new PosDomainException(
                message: "لا يمكن حذف هذا {$typeArabic} لوجود فواتير أو سندات سابقة أو رصيد غير مسوى.",
                errorCode: 'PARTY_HAS_TRANSACTIONS',
                statusCode: 422
            );
        }

        return (bool) $party->delete();
    }

    /**
     * استعلام قائمة العملاء والموردين وشركات الشحن مع البحث والتصفح
     */
    public function getPartiesPaginated(User $user, array $filters = []): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $query = $this->buildFilteredQuery($filters, includeBalanceFilter: true)
            ->withCount('invoices')
            ->withExists(['invoices', 'payments']);

        $perPage = min(max(1, (int) ($filters['per_page'] ?? 50)), 500);

        return $query->orderBy('name')->paginate($perPage);
    }

    /**
     * @return array<string, int|float>
     */
    public function getPartiesSummary(array $filters = []): array
    {
        $row = $this->buildFilteredQuery($filters, includeBalanceFilter: false)
            ->selectRaw('
                COUNT(*) as total_count,
                COALESCE(SUM(CASE WHEN balance != 0 THEN 1 ELSE 0 END), 0) as with_balance_count,
                COALESCE(SUM(CASE WHEN balance = 0 THEN 1 ELSE 0 END), 0) as zero_balance_count,
                COALESCE(SUM(balance), 0) as total_balance
            ')
            ->first();

        return [
            'total_count' => (int) ($row?->total_count ?? 0),
            'with_balance_count' => (int) ($row?->with_balance_count ?? 0),
            'zero_balance_count' => (int) ($row?->zero_balance_count ?? 0),
            'total_balance' => Money::of($row?->total_balance ?? 0)->getAmount(),
        ];
    }

    private function buildFilteredQuery(array $filters, bool $includeBalanceFilter): Builder
    {
        $type = $filters['type'] ?? null;
        $query = Party::query();

        if ($type && in_array($type, array_column(PartyType::cases(), 'value'))) {
            $query->where('type', $type);
        }

        if (!empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%")->orWhere('phone2', 'like', "%{$search}%"));
        }

        if ($includeBalanceFilter && !empty($filters['balance_status'])) {
            $status = (string) $filters['balance_status'];
            if ($status === 'WITH_BALANCE') {
                $query->where('balance', '!=', 0);
            } elseif ($status === 'ZERO_BALANCE') {
                $query->where('balance', '=', 0);
            }
        }

        return $query;
    }

    public function findForShowOrFail(int $id): Party
    {
        return Party::with(['ledgerEntries' => function ($q) {
            $q->latest()->limit(50);
        }])
            ->withExists(['invoices', 'payments'])
            ->findOrFail($id);
    }

    public function findOrFail(int $id): Party
    {
        return Party::findOrFail($id);
    }
}
