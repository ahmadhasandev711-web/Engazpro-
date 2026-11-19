<?php

namespace App\Services;

use App\Enums\BranchType;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\OnlineOrder;
use App\Models\Product;
use App\Models\User;
use App\Services\OnlineOrders\OnlineOrderStockReservationService;
use App\Support\Quantity;
use Illuminate\Support\Collection;

class BranchAvailabilityService
{
    public function __construct(
        private readonly OnlineOrderStockReservationService $reservationService,
    ) {}

    /**
     * Read-only availability across active fixed branches/warehouses (excluding VANs) for a product & its variants.
     */
    public function getProductAvailability(User $actor, Product $product): array
    {
        $accountId = $actor->getAccountId();
        $branches = $this->fixedActiveBranches($accountId);
        $branchIds = $branches->pluck('id')->all();

        $stockMap = $this->loadStockMap([$product->id], $branchIds);
        $reservedMap = $this->reservationService->reservedMapForProducts($accountId, [$product->id], $branchIds);

        $product->loadMissing('variants');
        $variants = $product->has_variants ? $product->variants->all() : [];

        return [
            'product_id' => $product->id,
            'product_name' => $product->name,
            'has_variants' => (bool) $product->has_variants,
            'branches' => $this->formatProductBranches($branches, $product, $variants, $stockMap, $reservedMap, $actor->branch_id),
        ];
    }

    /**
     * Evaluate fixed active branches for transferring an online order (3 constant queries, zero N+1).
     */
    public function getOrderBranchAvailability(User $actor, OnlineOrder $order): array
    {
        $accountId = $actor->getAccountId();
        $order->loadMissing(['items.product', 'items.variant']);
        $branches = $this->fixedActiveBranches($accountId);
        $branchIds = $branches->pluck('id')->all();
        $productIds = $order->items->pluck('product_id')->filter()->unique()->values()->all();

        $stockMap = $this->loadStockMap($productIds, $branchIds);
        $reservedMap = $this->reservationService->reservedMapForProducts($accountId, $productIds, $branchIds, $order->id);

        $evaluated = $branches->map(fn (Branch $b) => $this->evaluateBranchForOrder($b, $order, $stockMap, $reservedMap))
            ->sortByDesc(fn (array $row) => ($row['can_fulfill_all'] ? 2 : 0) + ($row['is_current'] ? 1 : 0))
            ->values()->all();

        return ['order_id' => $order->id, 'current_branch_id' => $order->branch_id, 'branches' => $evaluated];
    }

    private function fixedActiveBranches(int $accountId): Collection
    {
        return Branch::where('user_id', $accountId)
            ->whereIn('type', BranchType::fixedValues())
            ->where('is_active', true)
            ->orderByDesc('is_main')
            ->orderBy('name')
            ->get();
    }

    /**
     * @param  array<int>  $productIds
     * @param  array<int>  $branchIds
     * @return array<string, float>
     */
    private function loadStockMap(array $productIds, array $branchIds): array
    {
        if (empty($productIds) || empty($branchIds)) {
            return [];
        }

        $rows = BranchStock::withoutGlobalScopes()
            ->whereIn('product_id', $productIds)
            ->whereIn('branch_id', $branchIds)
            ->get(['branch_id', 'product_id', 'product_variant_id', 'quantity']);

        $map = [];
        foreach ($rows as $row) {
            $vKey = $row->product_variant_id ?? 0;
            $map["{$row->branch_id}:{$row->product_id}:{$vKey}"] = Quantity::of($row->quantity ?? 0)->toFloat();
        }

        return $map;
    }

    private function formatProductBranches(
        Collection $branches,
        Product $product,
        array $variants,
        array $stockMap,
        array $reservedMap,
        ?int $userBranchId
    ): array {
        return $branches->map(function (Branch $branch) use ($product, $variants, $stockMap, $reservedMap, $userBranchId) {
            $variantRows = $this->buildVariantBreakdown($branch->id, $product->id, $variants, $stockMap, $reservedMap);
            $totals = $this->resolveBranchTotals($branch->id, $product->id, $variantRows, $stockMap, $reservedMap);

            return [
                'id' => $branch->id,
                'name' => $branch->name,
                'type' => $branch->type instanceof BranchType ? $branch->type->value : (string) $branch->type,
                'type_label' => $branch->type instanceof BranchType ? $branch->type->label() : 'فرع',
                'is_main' => (bool) $branch->is_main,
                'is_user_branch' => $userBranchId !== null && (int) $userBranchId === (int) $branch->id,
                ...$totals,
                'variants' => $variantRows,
            ];
        })->values()->all();
    }

    private function buildVariantBreakdown(int $branchId, int $productId, array $variants, array $stockMap, array $reservedMap): array
    {
        return array_map(function ($variant) use ($branchId, $productId, $stockMap, $reservedMap) {
            $key = "{$branchId}:{$productId}:{$variant->id}";
            $physical = Quantity::of($stockMap[$key] ?? 0);
            $reserved = Quantity::of($reservedMap[$key] ?? 0);

            return [
                'id' => $variant->id,
                'name' => $variant->variant_name ?? $variant->name ?? "#{$variant->id}",
                'sku' => $variant->sku ?? null,
                'physical_quantity' => $physical->toFloat(),
                'reserved_quantity' => $reserved->toFloat(),
                'available_quantity' => $physical->subtract($reserved)->maxZero()->toFloat(),
            ];
        }, $variants);
    }

    private function resolveBranchTotals(int $branchId, int $productId, array $variantRows, array $stockMap, array $reservedMap): array
    {
        if (!empty($variantRows)) {
            $physical = array_sum(array_column($variantRows, 'physical_quantity'));
            $reserved = array_sum(array_column($variantRows, 'reserved_quantity'));
            $available = array_sum(array_column($variantRows, 'available_quantity'));

            return ['physical_quantity' => $physical, 'reserved_quantity' => $reserved, 'available_quantity' => $available];
        }

        $key = "{$branchId}:{$productId}:0";
        $physical = Quantity::of($stockMap[$key] ?? 0);
        $reserved = Quantity::of($reservedMap[$key] ?? 0);

        return [
            'physical_quantity' => $physical->toFloat(),
            'reserved_quantity' => $reserved->toFloat(),
            'available_quantity' => $physical->subtract($reserved)->maxZero()->toFloat(),
        ];
    }

    private function evaluateBranchForOrder(Branch $branch, OnlineOrder $order, array $stockMap, array $reservedMap): array
    {
        $shortages = [];
        foreach ($order->items as $item) {
            if ($msg = $this->checkItemShortage($branch->id, $item, $stockMap, $reservedMap)) {
                $shortages[] = $msg;
            }
        }

        return [
            'id' => $branch->id,
            'name' => $branch->name,
            'type' => $branch->type instanceof BranchType ? $branch->type->value : (string) $branch->type,
            'type_label' => $branch->type instanceof BranchType ? $branch->type->label() : 'فرع',
            'is_main' => (bool) $branch->is_main,
            'is_current' => $order->branch_id !== null && (int) $order->branch_id === (int) $branch->id,
            'can_fulfill_all' => empty($shortages),
            'shortages' => $shortages,
        ];
    }

    private function checkItemShortage(int $branchId, $item, array $stockMap, array $reservedMap): ?string
    {
        if (!$item->product_id) {
            return 'صنف غير مربوط بالنظام';
        }
        $vKey = $item->product_variant_id ?? 0;
        $key = "{$branchId}:{$item->product_id}:{$vKey}";
        $available = Quantity::of($stockMap[$key] ?? 0)->subtract(Quantity::of($reservedMap[$key] ?? 0))->maxZero();
        $required = Quantity::of($item->quantity ?? 1);

        if (!$available->isLessThan($required)) {
            return null;
        }

        $label = $item->product?->name ?? "صنف #{$item->product_id}";
        return "{$label} (متاح {$available->toFloat()} / مطلوب {$required->toFloat()})";
    }
}
