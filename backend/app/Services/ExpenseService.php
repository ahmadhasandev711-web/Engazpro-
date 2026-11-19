<?php

namespace App\Services;

use App\Enums\LedgerSource;
use App\Enums\PaymentMethod;
use App\Models\Expense;
use App\Models\Shift;
use App\Models\Treasury;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

class ExpenseService
{
    public function __construct(
        protected TreasuryService $treasuryService,
        protected ShiftService $shiftService
    ) {}

    /**
     * استعلام قائمة المصروفات مع الفلترة والصفحات
     */
    public function getExpensesPaginated(User $user, array $filters = []): array
    {
        $query = Expense::query()
            ->with(['treasury', 'creator', 'shift'])
            ->when($user->isMandob() || $user->isCashier(), fn($q) => $q->where('created_by', $user->id));

        app(BranchScopeService::class)->applyTreasuryOrCreatorBranchFilter($query, $user, 'treasury', 'creator', !empty($filters['branch_id']) ? (int) $filters['branch_id'] : null);
        $this->applyExpenseFilters($query, $filters);

        $totalAmount = Money::of((clone $query)->sum('amount') ?? 0)->getAmount();
        $perPage = min((int) ($filters['per_page'] ?? 20), 100);

        return [
            'paginator' => $query->latest()->paginate($perPage),
            'total_amount' => $totalAmount,
        ];
    }

    private function applyExpenseFilters($query, array $filters): void
    {
        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(fn($q) => $q->where('title', 'like', "%{$search}%")->orWhere('category', 'like', "%{$search}%")->orWhere('notes', 'like', "%{$search}%"));
        }
        if (!empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }
        if (!empty($filters['payment_method'])) {
            $query->where('payment_method', $filters['payment_method']);
        }
        if (!empty($filters['date_from'])) {
            $query->where('date', '>=', $filters['date_from']);
        }
        if (!empty($filters['date_to'])) {
            $query->where('date', '<=', $filters['date_to'] . ' 23:59:59');
        }
    }

    /**
     * تسجيل مصروف جديد وخصمه ذرياً من الخزينة المناسبة
     */
    public function createExpense(User $user, array $data): Expense
    {
        $method = !empty($data['payment_method'])
            ? ($data['payment_method'] instanceof PaymentMethod ? $data['payment_method'] : PaymentMethod::from($data['payment_method']))
            : PaymentMethod::CASH;
        $treasury = app(BranchScopeService::class)->resolveExpenseTreasury(
            $user,
            $this->treasuryService,
            $method,
            !empty($data['treasury_id']) ? (int) $data['treasury_id'] : null
        );
        $activeShift = ($method === PaymentMethod::CASH) ? $this->shiftService->getActiveShift($user) : null;

        return $this->persistExpenseWithWithdrawal($user, $data, $method, $treasury, $activeShift);
    }

    private function persistExpenseWithWithdrawal(User $user, array $data, PaymentMethod $method, $treasury, $activeShift): Expense
    {
        $expenseData = array_merge($data, [
            'created_by' => $user->id,
            'payment_method' => $method->value,
            'treasury_id' => $treasury->id,
            'shift_id' => $activeShift?->id,
        ]);

        return DB::transaction(function () use ($expenseData, $user, $treasury, $activeShift) {
            $expense = Expense::create($expenseData);
            $this->treasuryService->recordWithdrawal(
                treasury: $treasury,
                amount: Money::of($expense->amount),
                sourceType: 'EXPENSE',
                sourceId: $expense->id,
                actor: $user,
                notes: "مصروفات ({$expense->payment_method->label()}): {$expense->title}",
                shiftId: $activeShift?->id
            );
            if ($activeShift) {
                $this->shiftService->syncShiftFinancials($activeShift);
            }

            return $expense;
        });
    }

    /**
     * تعديل بيانات المصروف مع المزامنة المحاسبية الذرية للخزينة والوردية
     */
    public function updateExpense(Expense $expense, array $data, ?User $actor = null): Expense
    {
        return DB::transaction(function () use ($expense, $data, $actor) {
            $user = $actor ?? $expense->creator ?? User::findOrFail($expense->user_id);
            $data = $this->reconcileUpdatedExpenseTreasury($user, $expense, $data);
            $expense->update($data);
            $this->syncLinkedShift($expense->shift_id);

            return $expense->fresh(['treasury', 'creator', 'shift']);
        });
    }

    private function reconcileUpdatedExpenseTreasury(User $user, Expense $expense, array $data): array
    {
        $newMethod = !empty($data['payment_method'])
            ? ($data['payment_method'] instanceof PaymentMethod ? $data['payment_method'] : PaymentMethod::from((string) $data['payment_method']))
            : ($expense->payment_method instanceof PaymentMethod ? $expense->payment_method : PaymentMethod::CASH);
        $oldMethod = $expense->payment_method instanceof PaymentMethod ? $expense->payment_method : PaymentMethod::from((string) $expense->payment_method);
        $amountChanged = Money::of($expense->amount)->getCents() !== Money::of($data['amount'] ?? $expense->amount)->getCents();
        $treasuryChanged = !empty($data['treasury_id']) && (int) $data['treasury_id'] !== (int) $expense->treasury_id;

        if (!$amountChanged && $newMethod === $oldMethod && !$treasuryChanged) {
            return $data;
        }

        if ($expense->treasury_id && $oldTreasury = Treasury::withoutGlobalScopes()->where('user_id', $expense->user_id)->find($expense->treasury_id)) {
            $this->treasuryService->recordDeposit(treasury: $oldTreasury, amount: Money::of($expense->amount), sourceType: LedgerSource::REVERSAL->value, sourceId: $expense->id, actor: $user, notes: "عكس مصروف للتعديل: {$expense->title}", shiftId: $expense->shift_id);
        }

        $requestedTreasuryId = !empty($data['treasury_id']) ? (int) $data['treasury_id'] : ($newMethod === $oldMethod ? $expense->treasury_id : null);
        $targetTreasury = app(BranchScopeService::class)->resolveExpenseTreasury($user, $this->treasuryService, $newMethod, $requestedTreasuryId);
        $newAmount = Money::of($data['amount'] ?? $expense->amount);
        $title = $data['title'] ?? $expense->title;
        $this->treasuryService->recordWithdrawal(treasury: $targetTreasury, amount: $newAmount, sourceType: 'EXPENSE', sourceId: $expense->id, actor: $user, notes: "مصروف معدل ({$newMethod->label()}): {$title}", shiftId: $expense->shift_id);

        return array_merge($data, ['payment_method' => $newMethod->value, 'treasury_id' => $targetTreasury->id]);
    }

    /**
     * حذف المصروف وإرجاع المبلغ ذرياً للخزينة ومزامنة الوردية
     */
    public function deleteExpense(Expense $expense, ?User $actor = null): bool
    {
        return DB::transaction(function () use ($expense, $actor) {
            $user = $actor ?? $expense->creator ?? User::findOrFail($expense->user_id);
            if ($expense->treasury_id && $treasury = Treasury::withoutGlobalScopes()->where('user_id', $expense->user_id)->find($expense->treasury_id)) {
                $this->treasuryService->recordDeposit(treasury: $treasury, amount: Money::of($expense->amount), sourceType: LedgerSource::REVERSAL->value, sourceId: $expense->id, actor: $user, notes: "إلغاء وحذف مصروف: {$expense->title}", shiftId: $expense->shift_id);
            }
            $shiftId = $expense->shift_id;
            $deleted = (bool) $expense->delete();
            $this->syncLinkedShift($shiftId);

            return $deleted;
        });
    }

    private function syncLinkedShift(?int $shiftId): void
    {
        if ($shiftId && $shift = Shift::withoutGlobalScopes()->find($shiftId)) {
            $this->shiftService->syncShiftFinancials($shift);
        }
    }

    public function findOrFail(int $id): Expense
    {
        return Expense::findOrFail($id);
    }
}
