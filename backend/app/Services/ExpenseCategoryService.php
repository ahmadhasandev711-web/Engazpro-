<?php

namespace App\Services;

use App\Exceptions\PosDomainException;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class ExpenseCategoryService
{
    public const DEFAULT_CATEGORIES = [
        'وقود وبنزين',
        'طعام وضيافة',
        'صيانة وإصلاحات',
        'إكراميات ونثريات طريق',
        'إيجار ومرافق',
        'رواتب وسلفيات',
        'أخرى',
    ];

    /**
     * الحصول على تصنيفات المصروفات للمنشأة مع توليد الافتراضيات إذا كانت فارغة
     */
    public function getCategoriesForUser(User $user): Collection
    {
        $accountId = $user->getAccountId();

        $categories = ExpenseCategory::where('user_id', $accountId)
            ->orderBy('id', 'asc')
            ->get();

        if ($categories->isEmpty()) {
            $this->seedDefaultCategories($accountId);
            $categories = ExpenseCategory::where('user_id', $accountId)
                ->orderBy('id', 'asc')
                ->get();
        }

        return $categories;
    }

    /**
     * بذر التصنيفات الافتراضية لحساب المتجر
     */
    public function seedDefaultCategories(int $accountId): void
    {
        foreach (self::DEFAULT_CATEGORIES as $name) {
            ExpenseCategory::firstOrCreate(
                [
                    'user_id' => $accountId,
                    'name' => $name,
                ],
                [
                    'is_default' => true,
                ]
            );
        }
    }

    /**
     * إنشاء تصنيف مصروفات جديد
     */
    public function createCategory(User $user, string $name): ExpenseCategory
    {
        $accountId = $user->getAccountId();
        $name = trim($name);

        $exists = ExpenseCategory::where('user_id', $accountId)
            ->where('name', $name)
            ->exists();

        if ($exists) {
            throw new PosDomainException("تصنيف المصروفات '{$name}' مسجل بالفعل.", 'DUPLICATE_CATEGORY', 422);
        }

        return ExpenseCategory::create([
            'user_id' => $accountId,
            'name' => $name,
            'is_default' => false,
        ]);
    }

    /**
     * تعديل اسم تصنيف المصروفات وتحديث المصروفات المرتبطة به
     */
    public function updateCategory(User $user, ExpenseCategory $category, string $newName): ExpenseCategory
    {
        $accountId = $user->getAccountId();
        $newName = trim($newName);

        if ($category->user_id !== $accountId) {
            throw new PosDomainException('غير مصرح لك بتعديل هذا التصنيف.', 'UNAUTHORIZED', 403);
        }

        if ($category->name === $newName) {
            return $category;
        }

        $exists = ExpenseCategory::where('user_id', $accountId)
            ->where('name', $newName)
            ->where('id', '!=', $category->id)
            ->exists();

        if ($exists) {
            throw new PosDomainException("يوجد تصنيف آخر بالفعل باسم '{$newName}'.", 'DUPLICATE_CATEGORY', 422);
        }

        return DB::transaction(function () use ($category, $newName, $accountId) {
            $oldName = $category->name;

            $category->update([
                'name' => $newName,
            ]);

            // مزامنة الاسم الجديد في سجل المصروفات الحالية للحساب
            Expense::where('user_id', $accountId)
                ->where('category', $oldName)
                ->update(['category' => $newName]);

            return $category;
        });
    }

    /**
     * حذف تصنيف المصروفات
     */
    public function deleteCategory(User $user, ExpenseCategory $category): void
    {
        $accountId = $user->getAccountId();

        if ($category->user_id !== $accountId) {
            throw new PosDomainException('غير مصرح لك بحذف هذا التصنيف.', 'UNAUTHORIZED', 403);
        }

        $category->delete();
    }
}
