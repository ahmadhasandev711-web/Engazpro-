<?php

namespace App\Jobs;

use App\Enums\QueueName;
use App\Jobs\Middleware\WithTenantContext;
use App\Models\Promotion;
use App\Models\ShopifyIntegration;
use App\Models\WooCommerceIntegration;
use App\Services\Shopify\ShopifyPromotionSyncService;
use App\Services\WooCommerce\WooCommercePromotionSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PushPromotionToEcommerceJob implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 45;
    public array $backoff = [10, 60];
    public int $uniqueFor = 30;

    public function __construct(
        public int $userId,
        public int $promotionId,
        public string $action = 'upsert',
        public ?int $wcCouponId = null,
        public ?string $shopifyDiscountId = null
    ) {
        $this->onQueue(QueueName::DEFAULT->value);
    }

    public function middleware(): array
    {
        return [new WithTenantContext($this->userId)];
    }

    public function uniqueId(): string
    {
        return "{$this->userId}:promo:{$this->action}:{$this->promotionId}";
    }

    public function handle(
        WooCommercePromotionSyncService $wcPromoSync,
        ShopifyPromotionSyncService $shopifyPromoSync
    ): void {
        if ($this->action === 'delete') {
            $this->handleDelete($wcPromoSync, $shopifyPromoSync);
            return;
        }

        $promotion = Promotion::withoutGlobalScopes()->where('user_id', $this->userId)->find($this->promotionId);
        if (!$promotion || !$promotion->sync_to_ecommerce) {
            return;
        }

        $this->pushToWooCommerce($wcPromoSync, $promotion);
        $this->pushToShopify($shopifyPromoSync, $promotion);
    }

    private function pushToWooCommerce(WooCommercePromotionSyncService $wcPromoSync, Promotion $promotion): void
    {
        $wc = WooCommerceIntegration::withoutGlobalScopes()
            ->where('user_id', $this->userId)->where('is_active', true)->where('auto_sync_promotions', true)->first();
        if ($wc && !empty($wc->consumer_key) && !empty($wc->consumer_secret)) {
            $wcPromoSync->pushPromotion($wc, $promotion);
        }
    }

    private function pushToShopify(ShopifyPromotionSyncService $shopifyPromoSync, Promotion $promotion): void
    {
        $shopify = ShopifyIntegration::withoutGlobalScopes()
            ->where('user_id', $this->userId)->where('is_active', true)->where('auto_sync_promotions', true)->first();
        if ($shopify) {
            $shopifyPromoSync->pushPromotion($shopify, $promotion);
        }
    }

    private function handleDelete(WooCommercePromotionSyncService $wcPromoSync, ShopifyPromotionSyncService $shopifyPromoSync): void
    {
        if ($this->wcCouponId) {
            $wc = WooCommerceIntegration::withoutGlobalScopes()
                ->where('user_id', $this->userId)->where('is_active', true)->where('auto_sync_promotions', true)->first();
            if ($wc && !empty($wc->consumer_key) && !empty($wc->consumer_secret)) {
                $wcPromoSync->deleteRemotePromotion($wc, $this->wcCouponId);
            }
        }
        if ($this->shopifyDiscountId) {
            $shopify = ShopifyIntegration::withoutGlobalScopes()
                ->where('user_id', $this->userId)->where('is_active', true)->where('auto_sync_promotions', true)->first();
            if ($shopify) {
                $shopifyPromoSync->deleteRemotePromotion($shopify, $this->shopifyDiscountId);
            }
        }
    }
}
