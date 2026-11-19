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
        $isTransferTargets = ($filters['purpose'] ?? null) === 'transfer_targets' && $user->isManager();
        $query = Branch::where('user_id', $user->getAccountId());

        if ($isTransferTargets) {
            $query->select(['id', 'user_id', 'name', 'code', 'type', 'is_main', 'is_active'])
                ->where('is_active', true);
        } else {
            $query->withCount(['users', 'stocks']);
            app(BranchScopeService::class)->applyBranchFilter($query, $user, 'id');
        }

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
            $code = $this->resolveUniqueBranchCode($accountId, $data['code'] ?? null);

            $branch = Branch::create([
                'user_id' => $accountId,
                'name' => $data['name'],
                'code' => $code,
                'type' => $data['type'] ?? BranchType::STORE->value,
                'phone' => $data['phone'] ?? null,
                'address' => $data['address'] ?? null,
                'is_main' => !empty($data['is_main']),
                'is_active' => $data['is_active'] ?? true,
            ]);

            $this->initializeBranchStock($branch, $accountId);
            $this->ensureBranchSafe($branch, $accountId);

            return $branch;
        });
    }

    private function resolveUniqueBranchCode(int $accountId, ?string $code): string
    {
        if (empty($code)) {
            $seq = $this->sequenceService->next($accountId, DocumentType::BRANCH);
            $code = 'BR-' . str_pad((string) $seq, 2, '0', STR_PAD_LEFT);
        }

        if (Branch::where('user_id', $accountId)->where('code', $code)->exists()) {
            throw new BranchDomainException("كود الفرع {$code} مستخدم مسبقاً في متجرك.", 'BRANCH_CODE_EXISTS');
        }

        return $code;
    }

    private function initializeBranchStock(Branch $branch, int $accountId): void
    {
        $products = Product::where('user_id', $accountId)->with('variants')->get();
        foreach ($products as $prod) {
            $variants = $prod->variants->count() > 0 ? $prod->variants : [null];
            foreach ($variants as $variant) {
                BranchStock::firstOrCreate([
                    'branch_id' => $branch->id,
                    'product_id' => $prod->id,
                    'product_variant_id' => $variant?->id,
                ], [
                    'quantity' => 0,
                    'min_quantity' => $variant?->min_quantity ?? $prod->min_quantity,
                ]);
            }
        }
    }

    private function ensureBranchSafe(Branch $branch, int $accountId): void
    {
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

        return DB::transaction(function () use ($branch) {
            \App\Models\WooCommerceIntegration::withoutGlobalScopes()
                ->where('user_id', $branch->user_id)->where('online_branch_id', $branch->id)
                ->update(['online_branch_id' => null]);
            \App\Models\ShopifyIntegration::withoutGlobalScopes()
                ->where('user_id', $branch->user_id)->where('default_branch_id', $branch->id)
                ->update(['default_branch_id' => null]);
            \App\Models\ShopifyLocationMapping::withoutGlobalScopes()
                ->where('user_id', $branch->user_id)->where('branch_id', $branch->id)
                ->update(['branch_id' => null, 'is_active' => false]);

            return (bool) $branch->delete();
        });
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

        $perPage = min(max(1, (int) ($filters['per_page'] ?? config('pos.pagination.default', 30))), (int) config('pos.pagination.max', 100));

        return $query->paginate($perPage);
    }
}
