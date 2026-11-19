<?php

namespace App\Jobs;

use App\Enums\EcommercePlatform;
use App\Enums\QueueName;
use App\Jobs\Middleware\WithTenantContext;
use App\Models\ShopifyIntegration;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\Shopify\ShopifyPromotionSyncService;
use App\Services\WooCommerce\WooCommercePromotionSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PullEcommercePromotionsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 180;

    public function __construct(
        public int $accountId,
        public int $actingUserId,
        public string $platform
    ) {
        $this->onQueue(
            $platform === EcommercePlatform::SHOPIFY->value
                ? QueueName::SHOPIFY_BULK->value
                : QueueName::WOO_BULK->value
        );
    }

    public function middleware(): array
    {
        return [new WithTenantContext($this->actingUserId)];
    }

    public function handle(
        WooCommercePromotionSyncService $wcPromoSync,
        ShopifyPromotionSyncService $shopifyPromoSync
    ): array {
        $user = User::withoutGlobalScopes()->findOrFail($this->actingUserId);

        if ($this->platform === EcommercePlatform::SHOPIFY->value) {
            $integration = ShopifyIntegration::withoutGlobalScopes()->where('user_id', $this->accountId)->where('is_active', true)->firstOrFail();
            return $shopifyPromoSync->pullPromotions($user, $integration);
        }

        $integration = WooCommerceIntegration::withoutGlobalScopes()->where('user_id', $this->accountId)->where('is_active', true)->firstOrFail();

        return $wcPromoSync->pullCoupons($user, $integration);
    }
}
