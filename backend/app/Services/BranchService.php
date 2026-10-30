<?php

namespace App\Services;

use App\Enums\BranchType;
use App\Enums\DocumentType;
use App\Exceptions\BranchDomainException;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\User;
use App\Services\DocumentSequenceService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class BranchService
{
    public function __construct(
        protected ?DocumentSequenceService $sequenceService = null
    ) {
        $this->sequenceService ??= app(DocumentSequenceService::class);
    }
    /**
     * استرجاع فروع المتجر مع إحصائيات الموظفين والأصناف
     */
    public function getBranches(User $user, array $filters = []): Collection
    {
        $query = Branch::where('user_id', $user->getAccountId())
            ->withCount(['users', 'stocks']);

        if (!empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        if (isset($filters['is_active'])) {
            $query->where('is_active', filter_var($filters['is_active'], FILTER_VALIDATE_BOOLEAN));
        }

        return $query->orderByDesc('is_main')->orderBy('name')->get();
    }

    /**
     * إنشاء فرع جديد مع تهيئة سجلات الأرصدة الافتراضية لأصناف المتجر
     */
    public function createBranch(User $user, array $data): Branch
    {
        return DB::transaction(function () use ($user, $data) {
            $accountId = $user->getAccountId();

            // توليد كود الفرع إن لم يُحدد
            if (empty($data['code'])) {
                $seq = $this->sequenceService->next($accountId, DocumentType::BRANCH);
                $data['code'] = 'BR-' . str_pad((string) $seq, 2, '0', STR_PAD_LEFT);
            }

            // فحص تكرار الكود
            $exists = Branch::where('user_id', $accountId)->where('code', $data['code'])->exists();
            if ($exists) {
                throw new BranchDomainException("كود الفرع {$data['code']} مستخدم مسبقاً في متجرك.", 'BRANCH_CODE_EXISTS');
            }

            $branch = Branch::create([
                'user_id' => $accountId,
                'name' => $data['name'],
                'code' => $data['code'],
                'type' => $data['type'] ?? BranchType::STORE->value,
                'phone' => $data['phone'] ?? null,
                'address' => $data['address'] ?? null,
                'is_main' => !empty($data['is_main']),
                'is_active' => $data['is_active'] ?? true,
            ]);

            // تهيئة سجلات المخزون للفرع الجديد برصيد 0 لكافة أصناف المتجر
            $products = Product::where('user_id', $accountId)->with('variants')->get();
            foreach ($products as $prod) {
                if ($prod->variants->count() > 0) {
                    foreach ($prod->variants as $variant) {
                        BranchStock::firstOrCreate([
                            'branch_id' => $branch->id,
                            'product_id' => $prod->id,
                            'product_variant_id' => $variant->id,
                        ], [
                            'quantity' => 0,
                            'min_quantity' => $variant->min_quantity,
                        ]);
                    }
                } else {
                    BranchStock::firstOrCreate([
                        'branch_id' => $branch->id,
                        'product_id' => $prod->id,
                        'product_variant_id' => null,
                    ], [
                        'quantity' => 0,
                        'min_quantity' => $prod->min_quantity,
                    ]);
                }
            }

            // إنشاء خزينة الفرع التشغيلية تلقائياً
            \App\Models\Treasury::firstOrCreate([
                'user_id' => $accountId,
                'branch_id' => $branch->id,
                'type' => \App\Enums\TreasuryType::BRANCH_SAFE,
            ], [
                'name' => "خزينة مبيعات ({$branch->name})",
                'balance' => 0.00,
                'is_active' => true,
                'notes' => "الخزينة التشغيلية المعتمدة لاستقبال تقفيل ورديات فرع {$branch->name}",
            ]);

            return $branch;
        });
    }

    /**
     * تعديل بيانات الفرع
     */
    public function updateBranch(Branch $branch, array $data): Branch
    {
        if (isset($data['code']) && $data['code'] !== $branch->code) {
            $exists = Branch::where('user_id', $branch->user_id)
                ->where('code', $data['code'])
                ->where('id', '!=', $branch->id)
                ->exists();
            if ($exists) {
                throw new BranchDomainException("كود الفرع {$data['code']} مستخدم مسبقاً.", 'BRANCH_CODE_EXISTS');
            }
        }

        $branch->update($data);
        return $branch;
    }

    /**
     * حذف الفرع (مع التحقق من عدم وجود رصيد نشط أو كونه الفرع الرئيسي)
     */
    public function deleteBranch(Branch $branch): bool
    {
        if ($branch->is_main) {
            throw new BranchDomainException("لا يمكن حذف الفرع الرئيسي للمتجر.", 'CANNOT_DELETE_MAIN_BRANCH');
        }

        $hasStock = BranchStock::where('branch_id', $branch->id)->where('quantity', '>', 0)->exists();
        if ($hasStock) {
            throw new BranchDomainException("لا يمكن حذف الفرع لوجود أرصدة بضاعة قائمة فيه. يرجى نقل المخزون لفرع آخر أولاً.", 'BRANCH_HAS_STOCK');
        }

        return (bool) $branch->delete();
    }

    /**
     * ضمان وجود فرع رئيسي واسترجاعه
     */
    public function ensureDefaultBranch(User $user): Branch
    {
        $accountId = $user->getAccountId();
        $branch = Branch::where('user_id', $accountId)->where('is_main', true)->first();
        if (!$branch) {
            $branch = Branch::firstOrCreate(
                ['user_id' => $accountId, 'code' => 'BR-01'],
                [
                    'name' => 'الفرع الرئيسي',
                    'type' => BranchType::STORE->value,
                    'is_main' => true,
                    'is_active' => true,
                ]
            );
        }
        return $branch;
    }

    /**
     * جرد مخزون الفرع
     */
    public function getBranchInventory(Branch $branch, array $filters = []): LengthAwarePaginator
    {
        $query = BranchStock::where('branch_id', $branch->id)
            ->with(['product.category', 'variant']);

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->whereHas('product', function ($pq) use ($search) {
                $pq->where('name', 'like', "%{$search}%")
                   ->orWhere('barcode', 'like', "%{$search}%")
                   ->orWhere('code', 'like', "%{$search}%");
            });
        }

        if (!empty($filters['low_stock'])) {
            $query->whereColumn('quantity', '<=', 'min_quantity');
        }

        return $query->paginate($filters['per_page'] ?? 30);
    }
}
