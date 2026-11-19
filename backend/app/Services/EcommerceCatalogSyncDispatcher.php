<?php

namespace App\Services;

use App\Jobs\PushPriceToShopifyJob;
use App\Jobs\PushPriceToWooCommerceJob;
use App\Jobs\PushPromotionToEcommerceJob;
use App\Models\Promotion;
use App\Services\Shopify\ShopifyStockSyncGate;
use App\Services\WooCommerce\WooStockSyncGate;
use Illuminate\Support\Facades\DB;

class EcommerceCatalogSyncDispatcher
{
    public function dispatchProductPricePush(
        int $accountId,
        int $productId,
        ?int $wcProductId,
        ?int $shopifyProductId
    ): void {
        if ($accountId <= 0 || EcommerceSyncEchoGuard::isSuppressed($accountId)) {
            return;
        }

        DB::afterCommit(function () use ($accountId, $productId, $wcProductId, $shopifyProductId): void {
            if ($wcProductId && WooStockSyncGate::isPriceSyncActive($accountId)) {
                PushPriceToWooCommerceJob::dispatch($accountId, $productId);
            }
            if ($shopifyProductId && ShopifyStockSyncGate::isPriceSyncActive($accountId)) {
                PushPriceToShopifyJob::dispatch($accountId, $productId);
            }
        });
    }

    public function dispatchPromotionPush(Promotion $promotion): void
    {
        $accountId = (int) $promotion->user_id;
        if ($accountId <= 0 || !$promotion->sync_to_ecommerce || EcommerceSyncEchoGuard::isSuppressed($accountId)) {
            return;
        }

        $promoId = (int) $promotion->id;
        DB::afterCommit(function () use ($accountId, $promoId): void {
            if ($this->hasAnyPromotionSyncActive($accountId)) {
                PushPromotionToEcommerceJob::dispatch($accountId, $promoId, 'upsert');
            }
        });
    }

    public function dispatchPromotionDelete(
        int $accountId,
        int $promotionId,
        ?int $wcCouponId,
        ?string $shopifyDiscountId,
        bool $syncToEcommerce
    ): void {
        if ($accountId <= 0 || !$syncToEcommerce || EcommerceSyncEchoGuard::isSuppressed($accountId)) {
            return;
        }
        if ($wcCouponId === null && empty($shopifyDiscountId)) {
            return;
        }

        DB::afterCommit(function () use ($accountId, $promotionId, $wcCouponId, $shopifyDiscountId): void {
            if ($this->hasAnyPromotionSyncActive($accountId)) {
                PushPromotionToEcommerceJob::dispatch($accountId, $promotionId, 'delete', $wcCouponId, $shopifyDiscountId);
            }
        });
    }

    private function hasAnyPromotionSyncActive(int $accountId): bool
    {
        return WooStockSyncGate::isPromotionSyncActive($accountId)
            || ShopifyStockSyncGate::isPromotionSyncActive($accountId);
    }
}
