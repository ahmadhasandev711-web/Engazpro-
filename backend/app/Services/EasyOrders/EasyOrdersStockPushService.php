<?php

namespace App\Services\EasyOrders;

use App\Contracts\EasyOrdersApiClientInterface;
use App\Exceptions\EasyOrdersConnectionException;
use App\Models\Branch;
use App\Models\EasyOrdersIntegration;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\OnlineOrders\OnlineOrderStockReservationService;

class EasyOrdersStockPushService
{
    public function __construct(
        protected EasyOrdersApiClientInterface $apiClient,
        protected OnlineOrderStockReservationService $reservationService
    ) {}

    /**
     * @return array{pushed_entries: int, message: string}
     */
    public function pushProductForAccount(int $accountId, Product $product): array
    {
        if ((int) $product->user_id !== $accountId) {
            abort(403, 'غير مصرح لك بدفع مخزون هذا الصنف.');
        }

        $integration = EasyOrdersIntegration::where('user_id', $accountId)->where('is_active', true)->first();
        if (!$integration) {
            throw new EasyOrdersConnectionException('ربط متجر EasyOrders غير نشط أو غير مهيأ بعد.', 422);
        }

        $product->loadMissing('variants');
        $pushed = $this->pushProduct($integration, $product);
        $message = $pushed > 0
            ? "تم دفع رصيد '{$product->name}' إلى متجر EasyOrders بنجاح ({$pushed} تحديث)"
            : "لم يتم دفع رصيد للصنف '{$product->name}' لعدم وجود SKU أو Taager Code مرتبط بمتجر EasyOrders.";

        return ['pushed_entries' => $pushed, 'message' => $message];
    }

    public function pushProduct(EasyOrdersIntegration $integration, Product $product, ?int $onlyVariantId = null): int
    {
        $branchId = $this->resolveBranchId($integration);
        if (!$branchId) {
            return 0;
        }

        return $product->isVariable()
            ? $this->pushVariableProduct($integration, $product, $branchId, $onlyVariantId)
            : $this->pushSimpleProduct($integration, $product, $branchId);
    }

    public function resolveBranchId(EasyOrdersIntegration $integration): ?int
    {
        if ($integration->default_branch_id) {
            return (int) $integration->default_branch_id;
        }

        return Branch::where('user_id', $integration->user_id)->where('is_main', true)->value('id')
            ?? Branch::where('user_id', $integration->user_id)->where('is_active', true)->value('id');
    }

    private function pushSimpleProduct(EasyOrdersIntegration $integration, Product $product, int $branchId): int
    {
        $sku = trim((string) ($product->easyorders_sku ?: $product->code ?: ''));
        if ($sku === '') {
            return 0;
        }

        $qty = $this->availableInt($integration->user_id, $product->id, null, $branchId);
        $this->apiClient->updateProductStockBySku($integration, $sku, $qty);

        return 1;
    }

    private function pushVariableProduct(EasyOrdersIntegration $integration, Product $product, int $branchId, ?int $onlyVariantId): int
    {
        $pushed = 0;
        $variants = $product->variants->when($onlyVariantId, fn ($c) => $c->where('id', $onlyVariantId));
        $productCode = trim((string) ($product->easyorders_taager_code ?: $product->easyorders_sku ?: $product->code ?: ''));

        foreach ($variants as $variant) {
            $pushed += $this->pushSingleVariant($integration, $product, $variant, $productCode, $branchId);
        }

        return $pushed;
    }

    private function pushSingleVariant(EasyOrdersIntegration $integration, Product $product, ProductVariant $variant, string $productCode, int $branchId): int
    {
        $variantCode = trim((string) ($variant->easyorders_taager_code ?: $variant->code ?: ''));
        if ($productCode === '' || $variantCode === '') {
            return 0;
        }

        $qty = $this->availableInt($integration->user_id, $product->id, $variant->id, $branchId);
        $this->apiClient->updateVariantStock($integration, $productCode, $variantCode, $qty);

        return 1;
    }

    private function availableInt(int $accountId, int $productId, ?int $variantId, int $branchId): int
    {
        return max(0, (int) floor($this->reservationService->netAvailableForBranches($accountId, $productId, $variantId, [$branchId])->toFloat()));
    }
}
