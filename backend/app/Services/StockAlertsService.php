<?php

namespace App\Services;

use App\Enums\InvoiceType;
use App\Models\BranchStock;
use App\Models\InvoiceItem;
use App\Models\ProductBatch;
use App\Models\User;
use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class StockAlertsService
{
    public static function forgetForAccount(int $accountId): void
    {
        Cache::forget("stock_alerts_summary_{$accountId}_all");
        Cache::increment("stock_alerts_ver_{$accountId}");
    }

    public function getSummary(User $user): array
    {
        $accountId = $user->getAccountId();
        $branchId = ($user->isManager() && $user->branch_id) ? (int) $user->branch_id : null;
        $ver = Cache::get("stock_alerts_ver_{$accountId}", 1);
        $cacheKey = "stock_alerts_sum_{$accountId}_b" . ($branchId ?? 'all') . "_v{$ver}";

        return Cache::remember($cacheKey, 60, fn () => $this->computeSummary($accountId, $branchId));
    }

    public function getAlerts(User $user, array $filters = []): array
    {
        $accountId = $user->getAccountId();
        $branchId = ($user->isManager() && $user->branch_id) ? (int) $user->branch_id : (!empty($filters['branch_id']) ? (int) $filters['branch_id'] : null);
        $days = max(1, min(180, (int) ($filters['expiry_days'] ?? 30)));
        $statusFilter = (string) ($filters['status'] ?? 'ALL');
        $search = trim((string) ($filters['search'] ?? ''));

        $lowStockItems = $this->fetchLowStockBranchItems($accountId, $branchId, $statusFilter, $search);
        $expiringBatches = $this->fetchExpiringBatches($accountId, $days, $search);

        return [
            'summary' => $this->computeSummary($accountId, ($user->isManager() && $user->branch_id) ? (int) $user->branch_id : null),
            'low_stock_items' => $lowStockItems,
            'expiring_batches' => $expiringBatches,
        ];
    }

    private function computeSummary(int $accountId, ?int $branchId): array
    {
        $base = BranchStock::withoutGlobalScopes()
            ->join('branches', 'branches.id', '=', 'branch_stocks.branch_id')
            ->join('products', 'products.id', '=', 'branch_stocks.product_id')
            ->where('branches.user_id', $accountId)->where('branches.is_active', true)
            ->whereNull('products.deleted_at')
            ->when($branchId, fn ($q) => $q->where('branch_stocks.branch_id', $branchId));

        $outOfStock = (clone $base)->where('branch_stocks.quantity', '<=', 0)->count();
        $lowStock = (clone $base)->where('branch_stocks.quantity', '>', 0)
            ->whereNotNull('branch_stocks.min_quantity')
            ->whereColumn('branch_stocks.quantity', '<=', 'branch_stocks.min_quantity')->count();
        $expiring = ProductBatch::where('user_id', $accountId)->where('quantity', '>', 0)
            ->whereDate('expiry_date', '<=', now()->addDays(30)->toDateString())->count();

        return [
            'out_of_stock_count' => $outOfStock,
            'low_stock_count' => $lowStock,
            'expiring_batches_count' => $expiring,
            'total_alerts' => $outOfStock + $lowStock + $expiring,
        ];
    }

    private function fetchLowStockBranchItems(int $accountId, ?int $branchId, string $statusFilter, string $search): array
    {
        $rows = BranchStock::withoutGlobalScopes()->with(['branch:id,name', 'product:id,name,code,barcode,unit,purchase_price', 'variant:id,name,code,barcode,purchase_price'])
            ->join('branches', 'branches.id', '=', 'branch_stocks.branch_id')
            ->join('products', 'products.id', '=', 'branch_stocks.product_id')
            ->where('branches.user_id', $accountId)->where('branches.is_active', true)->whereNull('products.deleted_at')
            ->when($branchId, fn ($q) => $q->where('branch_stocks.branch_id', $branchId))
            ->when($search !== '', fn ($q) => $q->where(fn ($sq) => $sq->where('products.name', 'like', "%{$search}%")->orWhere('products.code', 'like', "%{$search}%")))
            ->where(fn ($q) => $this->applyAlertCondition($q, $statusFilter))
            ->select('branch_stocks.*')->orderBy('branch_stocks.quantity', 'asc')->limit(150)->get();

        $lastPurchases = $this->fetchLastPurchasesByProduct($accountId, $rows->pluck('product_id')->unique()->values()->all());

        return $rows->map(fn ($bs) => $this->formatLowStockRow($bs, $lastPurchases->get($bs->product_id)))->values()->all();
    }

    private function applyAlertCondition($query, string $statusFilter): void
    {
        if ($statusFilter === 'OUT_OF_STOCK') {
            $query->where('branch_stocks.quantity', '<=', 0);
        } elseif ($statusFilter === 'LOW_STOCK') {
            $query->where('branch_stocks.quantity', '>', 0)->whereNotNull('branch_stocks.min_quantity')->whereColumn('branch_stocks.quantity', '<=', 'branch_stocks.min_quantity');
        } else {
            $query->where('branch_stocks.quantity', '<=', 0)->orWhere(fn ($q) => $q->whereNotNull('branch_stocks.min_quantity')->whereColumn('branch_stocks.quantity', '<=', 'branch_stocks.min_quantity'));
        }
    }

    private function fetchLastPurchasesByProduct(int $accountId, array $productIds): Collection
    {
        if (empty($productIds)) {
            return collect();
        }

        return InvoiceItem::query()
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->leftJoin('parties', 'parties.id', '=', 'invoices.party_id')
            ->where('invoices.user_id', $accountId)->where('invoices.type', InvoiceType::PURCHASE->value)
            ->whereNull('invoices.deleted_at')->whereIn('invoice_items.product_id', $productIds)
            ->select(['invoice_items.product_id', 'invoice_items.unit_price', 'invoices.party_id', 'parties.name as supplier_name', 'invoices.date'])
            ->orderByDesc('invoices.date')->orderByDesc('invoice_items.id')->get()->unique('product_id')->keyBy('product_id');
    }

    private function formatLowStockRow(BranchStock $bs, ?object $lastPurchase): array
    {
        $qty = Quantity::of($bs->quantity ?? 0)->toFloat();
        $minQty = $bs->min_quantity !== null ? Quantity::of($bs->min_quantity)->toFloat() : 0;
        $target = $minQty > 0 ? Quantity::of($minQty)->add($minQty)->subtract(max(0, $qty)) : Quantity::of(5)->subtract(max(0, $qty));
        $cost = Money::of($lastPurchase->unit_price ?? $bs->variant?->purchase_price ?? $bs->product?->purchase_price ?? 0)->getAmount();

        return [
            'branch_stock_id' => $bs->id, 'branch_id' => $bs->branch_id, 'branch_name' => $bs->branch?->name,
            'product_id' => $bs->product_id, 'product_name' => $bs->product?->name, 'unit' => $bs->product?->unit ?? 'قطعة',
            'product_variant_id' => $bs->product_variant_id, 'variant_name' => $bs->variant?->name,
            'quantity' => $qty, 'min_quantity' => $minQty, 'is_out_of_stock' => $qty <= 0,
            'suggested_reorder_qty' => max(1, (int) ceil($target->toFloat())),
            'last_purchase_price' => $cost, 'last_supplier_id' => $lastPurchase?->party_id ? (int) $lastPurchase->party_id : null,
            'last_supplier_name' => $lastPurchase?->supplier_name,
        ];
    }

    private function fetchExpiringBatches(int $accountId, int $days, string $search): array
    {
        $cutoff = now()->addDays($days)->toDateString();

        return ProductBatch::with(['product:id,name,unit', 'variant:id,name'])
            ->where('user_id', $accountId)->where('quantity', '>', 0)->whereDate('expiry_date', '<=', $cutoff)
            ->when($search !== '', fn ($q) => $q->whereHas('product', fn ($pq) => $pq->where('name', 'like', "%{$search}%")))
            ->orderBy('expiry_date', 'asc')->limit(100)->get()
            ->map(fn (ProductBatch $b) => [
                'batch_id' => $b->id, 'product_id' => $b->product_id, 'product_name' => $b->product?->name,
                'variant_name' => $b->variant?->name, 'batch_number' => $b->batch_number,
                'expiry_date' => $b->expiry_date?->toDateString(),
                'days_remaining' => (int) now()->startOfDay()->diffInDays($b->expiry_date, false),
                'is_expired' => $b->expiry_date?->isPast() ?? false,
                'quantity' => Quantity::of($b->quantity)->toFloat(),
            ])->values()->all();
    }
}
