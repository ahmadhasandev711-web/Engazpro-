<?php

namespace App\Services;

use App\Enums\StockAdjustmentMode;
use App\Enums\StockMovementSource;
use App\Enums\StockMovementType;
use App\Exceptions\PosDomainException;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class StockOperationsService
{
    public function __construct(
        protected StockService $stockService
    ) {}

    public function adjustStock(User $user, array $data): array
    {
        $accountId = $user->getAccountId();
        $branchId = $this->resolveAuthorizedBranchId($user, (int) $data['branch_id']);

        return DB::transaction(function () use ($user, $accountId, $branchId, $data) {
            $branch = Branch::where('user_id', $accountId)->findOrFail($branchId);
            $product = Product::where('user_id', $accountId)->lockForUpdate()->findOrFail((int) $data['product_id']);
            $variant = !empty($data['product_variant_id'])
                ? ProductVariant::where('user_id', $accountId)->where('product_id', $product->id)->lockForUpdate()->findOrFail((int) $data['product_variant_id'])
                : null;
            $batch = !empty($data['product_batch_id'])
                ? ProductBatch::where('user_id', $accountId)->where('product_id', $product->id)->lockForUpdate()->findOrFail((int) $data['product_batch_id'])
                : null;

            return $this->applyAdjustment($user, $branch, $product, $variant, $batch, $data);
        });
    }

    public function getMovementsPaginated(User $user, array $filters = []): LengthAwarePaginator
    {
        $query = StockMovement::query()->with(['branch:id,name', 'product:id,name,code,barcode,unit', 'variant:id,name', 'batch:id,batch_number']);

        $branchId = ($user->isManager() && $user->branch_id) ? (int) $user->branch_id : (!empty($filters['branch_id']) ? (int) $filters['branch_id'] : null);
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }
        $this->applyMovementFilters($query, $filters);
        $perPage = min(max(1, (int) ($filters['per_page'] ?? 30)), 100);

        return $query->orderByDesc('id')->paginate($perPage);
    }

    private function resolveAuthorizedBranchId(User $user, int $requestedBranchId): int
    {
        if ($user->isManager() && $user->branch_id && $requestedBranchId !== (int) $user->branch_id) {
            throw new PosDomainException('عذراً، كمدير فرع يمكنك تسوية الجرد في فرعك المخصص فقط.', 'UNAUTHORIZED_BRANCH_ADJUSTMENT', 403);
        }

        return ($user->isManager() && $user->branch_id) ? (int) $user->branch_id : $requestedBranchId;
    }

    private function applyAdjustment(User $user, Branch $branch, Product $product, ?ProductVariant $variant, ?ProductBatch $batch, array $data): array
    {
        $currentBranchQty = BranchStock::withoutGlobalScopes()->where('branch_id', $branch->id)->where('product_id', $product->id)
            ->when($variant, fn ($q) => $q->where('product_variant_id', $variant->id), fn ($q) => $q->whereNull('product_variant_id'))
            ->value('quantity') ?? 0;

        $mode = StockAdjustmentMode::from((string) $data['mode']);
        [$movementType, $deltaQty] = $this->resolveMovementDelta($mode, Quantity::of($data['quantity']), Quantity::of($currentBranchQty));

        if ($deltaQty->isZero()) {
            return ['adjusted' => false, 'movement' => null, 'new_quantity' => Quantity::of($currentBranchQty)->toFloat(), 'message' => 'الرصيد الفعلي مطابق للرصيد الدفتري بالفعل.'];
        }

        $note = '[' . trim((string) $data['reason']) . '] ' . trim((string) ($data['notes'] ?? '')) . " — فرع: {$branch->name}";
        $cost = Money::of($batch?->purchase_price ?? $variant?->purchase_price ?? $product->purchase_price ?? 0)->getAmount();
        $movement = $this->stockService->recordMovement($user, $product, $movementType->value, StockMovementSource::ADJUSTMENT->value, null, $deltaQty->toFloat(), $cost, trim($note), $variant, $batch, $branch->id);

        $newQty = BranchStock::withoutGlobalScopes()->where('branch_id', $branch->id)->where('product_id', $product->id)
            ->when($variant, fn ($q) => $q->where('product_variant_id', $variant->id), fn ($q) => $q->whereNull('product_variant_id'))
            ->value('quantity') ?? 0;

        return [
            'adjusted' => true,
            'movement' => $movement->load(['branch:id,name', 'product:id,name,code,barcode,unit', 'variant:id,name', 'batch:id,batch_number']),
            'new_quantity' => Quantity::of($newQty)->toFloat(),
            'message' => 'تم اعتماد تسوية المخزون وتحديث الأرصدة والمتاجر الإلكترونية بنجاح.',
        ];
    }

    /**
     * @return array{0: StockMovementType, 1: Quantity}
     */
    private function resolveMovementDelta(StockAdjustmentMode $mode, Quantity $inputQty, Quantity $currentQty): array
    {
        if ($mode === StockAdjustmentMode::SET_ACTUAL) {
            if ($inputQty->isGreaterThan($currentQty)) {
                return [StockMovementType::IN, $inputQty->subtract($currentQty)];
            }
            if ($inputQty->isLessThan($currentQty)) {
                return [StockMovementType::OUT, $currentQty->subtract($inputQty)];
            }

            return [StockMovementType::IN, Quantity::zero()];
        }
        if ($inputQty->isZero() || $inputQty->isNegative()) {
            throw new PosDomainException('كمية التسوية يجب أن تكون أكبر من الصفر.', 'INVALID_QUANTITY');
        }

        return [$mode === StockAdjustmentMode::INCREASE ? StockMovementType::IN : StockMovementType::OUT, $inputQty];
    }

    private function applyMovementFilters($query, array $filters): void
    {
        if (!empty($filters['product_id'])) {
            $query->where('product_id', (int) $filters['product_id']);
        }
        if (!empty($filters['type']) && ($typeEnum = StockMovementType::tryFrom((string) $filters['type']))) {
            $query->where('type', $typeEnum->value);
        }
        if (!empty($filters['source_type']) && ($sourceEnum = StockMovementSource::tryFrom((string) $filters['source_type']))) {
            $query->where('source_type', $sourceEnum->value);
        }
        if (!empty($filters['date_from'])) {
            $query->whereDate('created_at', '>=', (string) $filters['date_from']);
        }
        if (!empty($filters['date_to'])) {
            $query->whereDate('created_at', '<=', (string) $filters['date_to']);
        }
        if (!empty($filters['search'])) {
            $s = trim((string) $filters['search']);
            $query->where(fn ($q) => $q->where('notes', 'like', "%{$s}%")->orWhereHas('product', fn ($pq) => $pq->where('name', 'like', "%{$s}%")->orWhere('code', 'like', "%{$s}%")));
        }
    }
}
