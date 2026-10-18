<?php

namespace App\Services;

use App\Enums\PaymentMethod;
use App\Enums\TreasuryTransactionType;
use App\Enums\TreasuryType;
use App\Models\Treasury;
use App\Models\TreasuryTransaction;
use App\Models\User;
use App\Support\Money;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class TreasuryService
{
    /**
     * الحصول على الخزينة العامة للمنشأة أو إنشائها تلقائياً
     */
    public function getMainTreasury(int $accountId): Treasury
    {
        return Treasury::withoutGlobalScopes()
            ->firstOrCreate(
                [
                    'user_id' => $accountId,
                    'type' => TreasuryType::MAIN,
                ],
                [
                    'name' => 'الخزينة المركزية العامة (الإدارة)',
                    'balance' => 0.00,
                    'is_active' => true,
                    'notes' => 'الخزينة المركزية للإدارة وصاحب العمل ككل',
                ]
            );
    }

    /**
     * الحصول على الخزينة الرئيسية للفرع أو إنشائها تلقائياً
     */
    public function getBranchTreasury(int $branchId, int $accountId): Treasury
    {
        $branch = \App\Models\Branch::withoutGlobalScopes()->where('user_id', $accountId)->find($branchId);
        $branchName = $branch?->name ?? "الفرع #{$branchId}";

        return Treasury::withoutGlobalScopes()
            ->firstOrCreate(
                [
                    'user_id' => $accountId,
                    'branch_id' => $branchId,
                    'type' => TreasuryType::BRANCH_SAFE,
                ],
                [
                    'name' => "خزينة مبيعات ({$branchName})",
                    'balance' => 0.00,
                    'is_active' => true,
                    'notes' => "الخزينة التشغيلية المعتمدة لفرع {$branchName}",
                ]
            );
    }

    /**
     * الحصول على الخزينة المرتبطة بالمستخدم (درج كاشير أو عهدة مندوب أو خزينة الفرع أو الخزينة العامة)
     */
    public function getTreasuryForUser(User $user): Treasury
    {
        $accountId = $user->getAccountId();

        if ($user->isMandob()) {
            return Treasury::withoutGlobalScopes()
                ->firstOrCreate(
                    [
                        'user_id' => $accountId,
                        'assigned_user_id' => $user->id,
                        'type' => TreasuryType::MANDOB_CUSTODY,
                    ],
                    [
                        'branch_id' => $user->branch_id,
                        'name' => "عهدة المندوب ({$user->name})",
                        'balance' => 0.00,
                        'is_active' => true,
                        'notes' => 'محفظة النقدية الميدانية للتحصيلات والمصاريف',
                    ]
                );
        }

        if ($user->isCashier()) {
            return Treasury::withoutGlobalScopes()
                ->firstOrCreate(
                    [
                        'user_id' => $accountId,
                        'assigned_user_id' => $user->id,
                        'type' => TreasuryType::CASHIER_DRAWER,
                    ],
                    [
                        'branch_id' => $user->branch_id,
                        'name' => "درج الكاشير ({$user->name})",
                        'balance' => 0.00,
                        'is_active' => true,
                        'notes' => 'درج نقدية نقطة البيع (POS)',
                    ]
                );
        }

        if ($user->branch_id) {
            return $this->getBranchTreasury($user->branch_id, $accountId);
        }

        return $this->getMainTreasury($accountId);
    }

    /**
     * الحصول على الخزينة أو المحفظة المناسبة لطريقة دفع محددة
     */
    public function getTreasuryForPaymentMethod(User $user, PaymentMethod|string $method, ?int $explicitTreasuryId = null): Treasury
    {
        $accountId = $user->getAccountId();
        $methodEnum = $method instanceof PaymentMethod ? $method : PaymentMethod::from($method);

        // إذا تم تحديد معرف خزينة صريح وكان المستخدم مصرحاً له
        if ($explicitTreasuryId) {
            $explicit = Treasury::withoutGlobalScopes()
                ->where('user_id', $accountId)
                ->find($explicitTreasuryId);
            if ($explicit) {
                return $explicit;
            }
        }

        return match ($methodEnum) {
            PaymentMethod::CASH => $this->getTreasuryForUser($user),
            PaymentMethod::VODAFONE_CASH => Treasury::withoutGlobalScopes()
                ->firstOrCreate(
                    [
                        'user_id' => $accountId,
                        'type' => TreasuryType::WALLET,
                        'name' => 'محفظة فودافون كاش',
                    ],
                    [
                        'balance' => 0.00,
                        'is_active' => true,
                        'notes' => 'محفظة فودافون كاش والمحافظ الإلكترونية للمتجر',
                    ]
                ),
            PaymentMethod::INSTAPAY => Treasury::withoutGlobalScopes()
                ->firstOrCreate(
                    [
                        'user_id' => $accountId,
                        'type' => TreasuryType::WALLET,
                        'name' => 'حساب إنستاباي (InstaPay)',
                    ],
                    [
                        'balance' => 0.00,
                        'is_active' => true,
                        'notes' => 'حساب إنستاباي للمتجر للتحويلات اللحظية',
                    ]
                ),
            PaymentMethod::TRANSFER, PaymentMethod::CARD => Treasury::withoutGlobalScopes()
                ->where('user_id', $accountId)
                ->where('type', TreasuryType::BANK)
                ->first() ?? $this->getMainTreasury($accountId),
            default => $this->getTreasuryForUser($user),
        };
    }

    /**
     * تسجيل حركة إيداع نقدية في الخزينة
     */
    public function recordDeposit(
        Treasury $treasury,
        Money $amount,
        string $sourceType,
        ?int $sourceId,
        User $actor,
        ?string $notes = null,
        ?int $shiftId = null
    ): TreasuryTransaction {
        return DB::transaction(function () use ($treasury, $amount, $sourceType, $sourceId, $actor, $notes, $shiftId) {
            /** @var Treasury $locked */
            $locked = Treasury::withoutGlobalScopes()->lockForUpdate()->findOrFail($treasury->id);

            $currentBalance = Money::of($locked->balance);
            $newBalance = $currentBalance->add($amount);

            $locked->update([
                'balance' => $newBalance->getAmount(),
            ]);

            return TreasuryTransaction::create([
                'user_id' => $locked->user_id,
                'created_by' => $actor->id,
                'treasury_id' => $locked->id,
                'shift_id' => $shiftId,
                'type' => TreasuryTransactionType::DEPOSIT,
                'amount' => $amount->getAmount(),
                'balance_before' => $currentBalance->getAmount(),
                'balance_after' => $newBalance->getAmount(),
                'source_type' => $sourceType,
                'source_id' => $sourceId,
                'date' => Carbon::today()->toDateString(),
                'notes' => $notes,
            ]);
        });
    }

    /**
     * تسجيل حركة سحب / صرف نقدية من الخزينة
     */
    public function recordWithdrawal(
        Treasury $treasury,
        Money $amount,
        string $sourceType,
        ?int $sourceId,
        User $actor,
        ?string $notes = null,
        ?int $shiftId = null
    ): TreasuryTransaction {
        return DB::transaction(function () use ($treasury, $amount, $sourceType, $sourceId, $actor, $notes, $shiftId) {
            /** @var Treasury $locked */
            $locked = Treasury::withoutGlobalScopes()->lockForUpdate()->findOrFail($treasury->id);

            $currentBalance = Money::of($locked->balance);
            $newBalance = $currentBalance->subtract($amount);

            $locked->update([
                'balance' => $newBalance->getAmount(),
            ]);

            return TreasuryTransaction::create([
                'user_id' => $locked->user_id,
                'created_by' => $actor->id,
                'treasury_id' => $locked->id,
                'shift_id' => $shiftId,
                'type' => TreasuryTransactionType::WITHDRAWAL,
                'amount' => $amount->getAmount(),
                'balance_before' => $currentBalance->getAmount(),
                'balance_after' => $newBalance->getAmount(),
                'source_type' => $sourceType,
                'source_id' => $sourceId,
                'date' => Carbon::today()->toDateString(),
                'notes' => $notes,
            ]);
        });
    }

    /**
     * تحويل نقدية بين خزنتين (أو توريد عهدة رسمية)
     */
    public function recordTransfer(
        Treasury $fromTreasury,
        Treasury $toTreasury,
        Money $amount,
        User $actor,
        ?string $notes = null,
        ?int $shiftId = null,
        TreasuryTransactionType $type = TreasuryTransactionType::TRANSFER
    ): TreasuryTransaction {
        return DB::transaction(function () use ($fromTreasury, $toTreasury, $amount, $actor, $notes, $shiftId, $type) {
            // القفل بترتيب المعرفات لمنع Deadlocks
            $firstId = min($fromTreasury->id, $toTreasury->id);
            $secondId = max($fromTreasury->id, $toTreasury->id);

            $first = Treasury::withoutGlobalScopes()->lockForUpdate()->findOrFail($firstId);
            $second = Treasury::withoutGlobalScopes()->lockForUpdate()->findOrFail($secondId);

            $lockedFrom = $first->id === $fromTreasury->id ? $first : $second;
            $lockedTo = $first->id === $toTreasury->id ? $first : $second;

            $fromBalanceBefore = Money::of($lockedFrom->balance);
            $fromBalanceAfter = $fromBalanceBefore->subtract($amount);

            $toBalanceBefore = Money::of($lockedTo->balance);
            $toBalanceAfter = $toBalanceBefore->add($amount);

            $lockedFrom->update(['balance' => $fromBalanceAfter->getAmount()]);
            $lockedTo->update(['balance' => $toBalanceAfter->getAmount()]);

            return TreasuryTransaction::create([
                'user_id' => $lockedFrom->user_id,
                'created_by' => $actor->id,
                'treasury_id' => $lockedFrom->id,
                'target_treasury_id' => $lockedTo->id,
                'shift_id' => $shiftId,
                'type' => $type,
                'amount' => $amount->getAmount(),
                'balance_before' => $fromBalanceBefore->getAmount(),
                'balance_after' => $fromBalanceAfter->getAmount(),
                'source_type' => 'SHIFT_HANDOVER',
                'source_id' => $shiftId,
                'date' => Carbon::today()->toDateString(),
                'notes' => $notes,
            ]);
        });
    }

    /**
     * إنشاء خزينة جديدة أو حساب بنكي أو محفظة (صاحب العمل / المدير العام)
     */
    public function createTreasury(array $data, User $actor): Treasury
    {
        return DB::transaction(function () use ($data, $actor) {
            $accountId = $actor->getAccountId();
            $type = TreasuryType::from($data['type']);
            $branchId = !empty($data['branch_id']) ? (int) $data['branch_id'] : null;

            return Treasury::create([
                'user_id' => $accountId,
                'branch_id' => $branchId,
                'name' => $data['name'],
                'type' => $type,
                'balance' => !empty($data['opening_balance']) ? Money::of($data['opening_balance'])->getAmount() : 0.00,
                'assigned_user_id' => !empty($data['assigned_user_id']) ? (int) $data['assigned_user_id'] : null,
                'is_active' => $data['is_active'] ?? true,
                'notes' => $data['notes'] ?? null,
            ]);
        });
    }

    /**
     * تعديل بيانات الخزينة
     */
    public function updateTreasury(Treasury $treasury, array $data): Treasury
    {
        $treasury->update([
            'name' => $data['name'] ?? $treasury->name,
            'branch_id' => array_key_exists('branch_id', $data) ? $data['branch_id'] : $treasury->branch_id,
            'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : $treasury->is_active,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $treasury->notes,
        ]);

        return $treasury->fresh(['assignedUser', 'branch']);
    }

    /**
     * استعراض قائمة الخزن المتاحة للمستخدم وفق الصلاحيات الصارمة (RBAC)
     */
    public function getTreasuries(User $user, ?int $branchId = null, bool $forTransfer = false): Collection
    {
        $accountId = $user->getAccountId();

        // إذا كان للمستخدم فرع، نتأكد من وجود خزينة لفرعه
        if ($user->branch_id) {
            $this->getBranchTreasury($user->branch_id, $accountId);
        }

        $query = Treasury::with(['assignedUser', 'branch']);

        // 1. الكاشير والمندوب: لا يريان إلا الخزينة المعينة لهما فقط
        if ($user->isMandob() || $user->isCashier()) {
            return $query->where('assigned_user_id', $user->id)->orderBy('type')->get();
        }

        // 2. مدير الفرع والمشرف:
        if ($user->isManager() || $user->isSupervisor()) {
            if ($forTransfer && $user->isManager()) {
                // عند التحويل/التوريد، يحق لمدير الفرع اختيار خزن فرعه أو الخزنة العامة أو البنك كوجهة
                return $query->where(function ($q) use ($user) {
                    $q->where('branch_id', $user->branch_id)
                      ->orWhereIn('type', [TreasuryType::MAIN, TreasuryType::BANK]);
                })
                ->where('type', '!=', TreasuryType::OWNER_DRAWINGS)
                ->orderBy('type')
                ->get();
            }

            return $query->where('branch_id', $user->branch_id)
                ->whereNotIn('type', [
                    TreasuryType::BANK,
                    TreasuryType::WALLET,
                    TreasuryType::OWNER_DRAWINGS,
                ])
                ->orderBy('type')
                ->get();
        }

        // 3. صاحب العمل والمدير العام: يريان الكل مع إمكانية الفلترة بفرع محدد
        if ($branchId) {
            $query->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)
                  ->orWhereNull('branch_id'); // يظهر الحسابات البنكية المركزية مع الفرع
            });
        }

        return $query->orderBy('type')->get();
    }

    /**
     * استعلام كشف حركات الخزينة مع الفلترة والصفحات
     */
    public function getTransactionsPaginated(Treasury $treasury, array $filters = []): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $query = TreasuryTransaction::where(function ($q) use ($treasury) {
                $q->where('treasury_id', $treasury->id)
                  ->orWhere('target_treasury_id', $treasury->id);
            })
            ->with(['creator', 'treasury', 'targetTreasury'])
            ->latest('id');

        if (!empty($filters['date_from'])) {
            $query->where('date', '>=', $filters['date_from']);
        }
        if (!empty($filters['date_to'])) {
            $query->where('date', '<=', $filters['date_to'] . ' 23:59:59');
        }

        $perPage = min((int) ($filters['per_page'] ?? 30), 100);
        return $query->paginate($perPage);
    }
}
