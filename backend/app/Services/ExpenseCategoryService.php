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
        if ($user->isMandob()) {
            throw new PosDomainException('عذراً، لا تملك صلاحية إضافة أو تعديل تصنيفات المصروفات.', 'UNAUTHORIZED', 403);
        }

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
        if ($user->isMandob()) {
            throw new PosDomainException('عذراً، لا تملك صلاحية إضافة أو تعديل تصنيفات المصروفات.', 'UNAUTHORIZED', 403);
        }

        $accountId = $user->getAccountId();
        $newName = trim($newName);

        if ($category->user_id !== $accountId) {
            throw new PosDomainException('غير مصرح لك بتعديل هذا التصنيف.', 'UNAUTHORIZED', 403);
        }
        if ($category->name === $newName) {
            return $category;
        }
        $this->assertCategoryNameUnique($accountId, $newName, $category->id);

        return DB::transaction(function () use ($category, $newName, $accountId) {
            $oldName = $category->name;
            $category->update(['name' => $newName]);
            Expense::where('user_id', $accountId)->where('category', $oldName)->update(['category' => $newName]);

            return $category;
        });
    }

    private function assertCategoryNameUnique(int $accountId, string $name, int $ignoreId): void
    {
        $exists = ExpenseCategory::where('user_id', $accountId)
            ->where('name', $name)
            ->where('id', '!=', $ignoreId)
            ->exists();

        if ($exists) {
            throw new PosDomainException("يوجد تصنيف آخر بالفعل باسم '{$name}'.", 'DUPLICATE_CATEGORY', 422);
        }
    }

    /**
     * حذف تصنيف المصروفات
     */
    public function deleteCategory(User $user, ExpenseCategory $category): void
    {
        if (!$user->isOwnerOrAdmin() && !$user->isManager()) {
            throw new PosDomainException('عذراً، حذف تصنيفات المصروفات مقتصر على المالك والإدارة ومديري الفروع فقط.', 'UNAUTHORIZED', 403);
        }

        $accountId = $user->getAccountId();

        if ($category->user_id !== $accountId) {
            throw new PosDomainException('غير مصرح لك بحذف هذا التصنيف.', 'UNAUTHORIZED', 403);
        }

        $category->delete();
    }

    public function findForUserOrFail(User $user, int $id): ExpenseCategory
    {
        return ExpenseCategory::where('user_id', $user->getAccountId())->findOrFail($id);
    }
}
