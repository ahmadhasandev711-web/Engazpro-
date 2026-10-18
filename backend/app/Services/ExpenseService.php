<?php

namespace App\Services;

use App\Enums\PaymentMethod;
use App\Models\Expense;
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
            ->with(['treasury', 'creator'])
            ->when($user->isMandob() || $user->isCashier(), fn($q) => $q->where('created_by', $user->id));

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('category', 'like', "%{$search}%")
                  ->orWhere('notes', 'like', "%{$search}%");
            });
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

        $totalAmount = Money::of((clone $query)->sum('amount') ?? 0)->getAmount();
        $perPage = min((int) ($filters['per_page'] ?? 20), 100);
        $expenses = $query->latest()->paginate($perPage);

        return [
            'paginator' => $expenses,
            'total_amount' => $totalAmount,
        ];
    }

    /**
     * تسجيل مصروف جديد وخصمه ذرياً من الخزينة المناسبة
     */
    public function createExpense(User $user, array $data): Expense
    {
        $method = !empty($data['payment_method'])
            ? ($data['payment_method'] instanceof PaymentMethod ? $data['payment_method'] : PaymentMethod::from($data['payment_method']))
            : PaymentMethod::CASH;

        $explicitTreasuryId = !empty($data['treasury_id']) ? (int) $data['treasury_id'] : null;
        $treasury = $this->treasuryService->getTreasuryForPaymentMethod($user, $method, $explicitTreasuryId);

        $activeShift = ($method === PaymentMethod::CASH)
            ? $this->shiftService->getActiveShift($user)
            : null;

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
     * تعديل بيانات المصروف
     */
    public function updateExpense(Expense $expense, array $data): Expense
    {
        $expense->update($data);
        return $expense;
    }

    /**
     * حذف المصروف
     */
    public function deleteExpense(Expense $expense): bool
    {
        return (bool) $expense->delete();
    }
}
