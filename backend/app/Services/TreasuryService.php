<?php

namespace App\Services;

use App\Enums\PaymentMethod;
use App\Enums\TreasuryTransactionType;
use App\Enums\TreasuryType;
use App\Exceptions\PosDomainException;
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
            return $this->firstOrCreateUserSafe($user, $accountId, TreasuryType::MANDOB_CUSTODY, "عهدة المندوب ({$user->name})", 'محفظة النقدية الميدانية للتحصيلات والمصاريف');
        }
        if ($user->isCashier()) {
            return $this->firstOrCreateUserSafe($user, $accountId, TreasuryType::CASHIER_DRAWER, "درج الكاشير ({$user->name})", 'درج نقدية نقطة البيع (POS)');
        }

        return $user->branch_id ? $this->getBranchTreasury($user->branch_id, $accountId) : $this->getMainTreasury($accountId);
    }

    private function firstOrCreateUserSafe(User $user, int $accountId, TreasuryType $type, string $name, string $notes): Treasury
    {
        return Treasury::withoutGlobalScopes()->firstOrCreate(
            ['user_id' => $accountId, 'assigned_user_id' => $user->id, 'type' => $type],
            ['branch_id' => $user->branch_id, 'name' => $name, 'balance' => 0.00, 'is_active' => true, 'notes' => $notes]
        );
    }

    /**
     * الحصول على الخزينة أو المحفظة المناسبة لطريقة دفع محددة
     */
    public function getTreasuryForPaymentMethod(User $user, PaymentMethod|string $method, ?int $explicitTreasuryId = null): Treasury
    {
        $accountId = $user->getAccountId();
        $methodEnum = $method instanceof PaymentMethod ? $method : PaymentMethod::from($method);

        if ($explicitTreasuryId && ($explicit = Treasury::withoutGlobalScopes()->where('user_id', $accountId)->find($explicitTreasuryId))) {
            return $explicit;
        }

        return match ($methodEnum) {
            PaymentMethod::VODAFONE_CASH => $this->firstOrCreateWallet($accountId, 'محفظة فودافون كاش', 'محفظة فودافون كاش والمحافظ الإلكترونية للمتجر'),
            PaymentMethod::INSTAPAY => $this->firstOrCreateWallet($accountId, 'حساب إنستاباي (InstaPay)', 'حساب إنستاباي للمتجر للتحويلات اللحظية'),
            PaymentMethod::TRANSFER, PaymentMethod::CARD => Treasury::withoutGlobalScopes()->where('user_id', $accountId)->where('type', TreasuryType::BANK)->first() ?? $this->getMainTreasury($accountId),
            default => $this->getTreasuryForUser($user),
        };
    }

    private function firstOrCreateWallet(int $accountId, string $name, string $notes): Treasury
    {
        return Treasury::withoutGlobalScopes()->firstOrCreate(
            ['user_id' => $accountId, 'type' => TreasuryType::WALLET, 'name' => $name],
            ['balance' => 0.00, 'is_active' => true, 'notes' => $notes]
        );
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
        return $this->recordAdjustment($treasury, $amount, TreasuryTransactionType::DEPOSIT, $sourceType, $sourceId, $actor, $notes, $shiftId);
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
        return $this->recordAdjustment($treasury, $amount, TreasuryTransactionType::WITHDRAWAL, $sourceType, $sourceId, $actor, $notes, $shiftId);
    }

    private function recordAdjustment(
        Treasury $treasury,
        Money $amount,
        TreasuryTransactionType $type,
        string $sourceType,
        ?int $sourceId,
        User $actor,
        ?string $notes,
        ?int $shiftId
    ): TreasuryTransaction {
        return DB::transaction(function () use ($treasury, $amount, $type, $sourceType, $sourceId, $actor, $notes, $shiftId) {
            /** @var Treasury $locked */
            $locked = Treasury::withoutGlobalScopes()->lockForUpdate()->findOrFail($treasury->id);
            $currentBalance = Money::of($locked->balance);
            $newBalance = $type === TreasuryTransactionType::DEPOSIT ? $currentBalance->add($amount) : $currentBalance->subtract($amount);
            $locked->update(['balance' => $newBalance->getAmount()]);

            return TreasuryTransaction::create([
                'user_id' => $locked->user_id, 'created_by' => $actor->id, 'treasury_id' => $locked->id, 'shift_id' => $shiftId,
                'type' => $type, 'amount' => $amount->getAmount(), 'balance_before' => $currentBalance->getAmount(),
                'balance_after' => $newBalance->getAmount(), 'source_type' => $sourceType, 'source_id' => $sourceId,
                'date' => Carbon::today()->toDateString(), 'notes' => $notes,
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
            [$lockedFrom, $lockedTo] = $this->lockTwoTreasuries($fromTreasury->id, $toTreasury->id);
            $fromBefore = Money::of($lockedFrom->balance);
            $fromAfter = $fromBefore->subtract($amount);
            $toAfter = Money::of($lockedTo->balance)->add($amount);

            $lockedFrom->update(['balance' => $fromAfter->getAmount()]);
            $lockedTo->update(['balance' => $toAfter->getAmount()]);

            return $this->createTransferTransaction($lockedFrom, $lockedTo, $amount, $fromBefore, $fromAfter, $actor, $notes, $shiftId, $type);
        });
    }

    private function lockTwoTreasuries(int $fromId, int $toId): array
    {
        $first = Treasury::withoutGlobalScopes()->lockForUpdate()->findOrFail(min($fromId, $toId));
        $second = Treasury::withoutGlobalScopes()->lockForUpdate()->findOrFail(max($fromId, $toId));

        if ((int) $first->user_id !== (int) $second->user_id) {
            throw new PosDomainException('لا يمكن تحويل النقدية بين خزائن منشآت مختلفة.', 'TREASURY_TENANT_MISMATCH', 403);
        }

        return $first->id === $fromId ? [$first, $second] : [$second, $first];
    }

    private function createTransferTransaction(
        Treasury $from,
        Treasury $to,
        Money $amount,
        Money $balanceBefore,
        Money $balanceAfter,
        User $actor,
        ?string $notes,
        ?int $shiftId,
        TreasuryTransactionType $type
    ): TreasuryTransaction {
        return TreasuryTransaction::create([
            'user_id' => $from->user_id, 'created_by' => $actor->id, 'treasury_id' => $from->id, 'target_treasury_id' => $to->id,
            'shift_id' => $shiftId, 'type' => $type, 'amount' => $amount->getAmount(),
            'balance_before' => $balanceBefore->getAmount(), 'balance_after' => $balanceAfter->getAmount(),
            'source_type' => 'SHIFT_HANDOVER', 'source_id' => $shiftId, 'date' => Carbon::today()->toDateString(), 'notes' => $notes,
        ]);
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
        if ($user->branch_id) {
            $this->getBranchTreasury($user->branch_id, $user->getAccountId());
        }

        $query = Treasury::with(['assignedUser', 'branch']);

        if ($user->isMandob() || $user->isCashier()) {
            return $query->where('assigned_user_id', $user->id)->orderBy('type')->get();
        }
        if (!$user->isOwnerOrAdmin()) {
            return $this->getManagerScopedTreasuries($query, $user, $forTransfer);
        }
        if ($branchId) {
            $query->where(fn($q) => $q->where('branch_id', $branchId)->orWhereNull('branch_id'));
        }

        return $query->orderBy('type')->get();
    }

    private function getManagerScopedTreasuries($query, User $user, bool $forTransfer): Collection
    {
        $scope = app(BranchScopeService::class);
        if ($scope->shouldFailClosedWithoutBranch($user)) {
            return new Collection();
        }

        $excluded = [TreasuryType::MAIN->value, TreasuryType::BANK->value, TreasuryType::WALLET->value, TreasuryType::OWNER_DRAWINGS->value];
        if ($forTransfer && $user->isManager()) {
            $query->where('type', '!=', TreasuryType::OWNER_DRAWINGS->value)
                ->when($user->branch_id, fn ($q) => $q->where(fn ($sub) => $sub->where('branch_id', $user->branch_id)->orWhereIn('type', [TreasuryType::MAIN->value, TreasuryType::BANK->value])));

            return $query->orderBy('type')->get();
        }

        $scope->applyBranchFilter($query, $user, 'branch_id');

        return $query->whereNotIn('type', $excluded)->orderBy('type')->get();
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

    public function findOrFail(int $id): Treasury
    {
        return Treasury::findOrFail($id);
    }

    public function findForShowOrFail(int $id): Treasury
    {
        return Treasury::with(['assignedUser', 'branch'])->findOrFail($id);
    }

    public function transferBetweenTreasuries(
        User $actor,
        int $fromTreasuryId,
        int $toTreasuryId,
        Money $amount,
        ?string $notes = null
    ): TreasuryTransaction {
        $from = $this->findOrFail($fromTreasuryId);
        $to = $this->findOrFail($toTreasuryId);

        $this->assertManagerCanTransfer($actor, $from, $to);

        return $this->recordTransfer(
            fromTreasury: $from,
            toTreasury: $to,
            amount: $amount,
            actor: $actor,
            notes: $notes ?? 'تحويل إداري بين الخزن'
        );
    }

    private function assertManagerCanTransfer(User $actor, Treasury $from, Treasury $to): void
    {
        if ($actor->isOwnerOrAdmin()) {
            return;
        }

        $scope = app(BranchScopeService::class);
        if (!$scope->canAccessTreasury($actor, $from)) {
            throw new PosDomainException('عذراً، يمكنك التحويل فقط من خزن فرعك التابع له.', 'TREASURY_FORBIDDEN', 403);
        }

        $toType = $to->type instanceof \BackedEnum ? $to->type->value : (string) $to->type;
        $isAllowedDest = $scope->canAccessBranch($actor, $to->branch_id)
            || in_array($toType, [TreasuryType::BANK->value, TreasuryType::MAIN->value], true);

        if (!$isAllowedDest || $toType === TreasuryType::OWNER_DRAWINGS->value) {
            throw new PosDomainException('عذراً، يمكنك التوريد فقط إلى خزن فرعك، أو الحساب البنكي، أو الخزنة المركزية.', 'TREASURY_FORBIDDEN', 403);
        }
    }
}
