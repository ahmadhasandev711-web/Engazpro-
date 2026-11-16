<?php

namespace App\Services;

use App\Enums\LedgerSource;
use App\Enums\PartyType;
use App\Exceptions\PosDomainException;
use App\Models\Party;
use App\Models\User;
use App\Support\Money;
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
        $type = $filters['type'] ?? null;

        $query = Party::withCount('invoices')
            ->withExists(['invoices', 'payments']);

        if ($type && in_array($type, array_column(PartyType::cases(), 'value'))) {
            $query->where('type', $type);
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('phone2', 'like', "%{$search}%");
            });
        }

        $perPage = min((int) ($filters['per_page'] ?? 50), 500);
        return $query->orderBy('name')->paginate($perPage);
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
