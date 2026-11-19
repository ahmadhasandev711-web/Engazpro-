<?php

namespace App\Services\WooCommerce;

use App\Contracts\WooCommerceApiClientInterface;
use App\Enums\EcommercePlatform;
use App\Exceptions\WooCommerceConnectionException;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\EcommerceSyncEchoGuard;
use App\Support\Money;
use Illuminate\Support\Collection;

class WooCommercePricePushService
{
    public function __construct(
        protected WooCommerceApiClientInterface $apiClient
    ) {}

    /**
     * @return array{regular_price: string, sale_price: string}
     */
    public function resolveWcPrices(mixed $regularPrice, mixed $salePrice): array
    {
        $reg = Money::of($regularPrice ?? 0);
        $sale = Money::of($salePrice ?? 0);

        if ($reg->isGreaterThan($sale) && $sale->isPositive()) {
            return [
                'regular_price' => $reg->toDecimalString(),
                'sale_price' => $sale->toDecimalString(),
            ];
        }

        $effective = $sale->isPositive() ? $sale : $reg;

        return [
            'regular_price' => $effective->toDecimalString(),
            'sale_price' => '',
        ];
    }

    public function pushProduct(WooCommerceIntegration $integration, Product $product): int
    {
        if (empty($product->wc_product_id)) {
            return 0;
        }

        $variants = $product->relationLoaded('variants') ? $product->variants : $product->variants()->get();
        $linkedVariants = $variants->filter(fn (ProductVariant $v) => !empty($v->wc_variation_id));

        if ($linkedVariants->isNotEmpty()) {
            return $this->pushVariableProduct($integration, $product, $linkedVariants);
        }

        return $this->pushSimpleProduct($integration, $product);
    }

    /**
     * @return array{synced_count: int, failed_count: int}
     */
    public function pushAll(User $user, WooCommerceIntegration $integration): array
    {
        $synced = 0;
        $failed = 0;

        Product::withoutGlobalScopes()
            ->where('user_id', $integration->user_id)
            ->whereNotNull('wc_product_id')
            ->with('variants')
            ->chunkById(50, function (Collection $products) use ($integration, &$synced, &$failed): void {
                foreach ($products as $product) {
                    $pushed = $this->tryPushSingle($integration, $product);
                    $pushed ? $synced++ : $failed++;
                }
            });

        return ['synced_count' => $synced, 'failed_count' => $failed];
    }

    private function pushSimpleProduct(WooCommerceIntegration $integration, Product $product): int
    {
        $prices = $this->resolveWcPrices($product->regular_price, $product->sale_price);
        $effectiveSale = $prices['sale_price'] !== '' ? $prices['sale_price'] : $prices['regular_price'];

        EcommerceSyncEchoGuard::recordEcho(
            EcommercePlatform::WOOCOMMERCE,
            'product_price',
            (int) $integration->user_id,
            (int) $product->wc_product_id,
            EcommerceSyncEchoGuard::priceFingerprint($prices['regular_price'], $effectiveSale)
        );

        if (!$this->apiClient->updateProductPrices($integration, (int) $product->wc_product_id, $prices['regular_price'], $prices['sale_price'])) {
            throw new WooCommerceConnectionException("Failed to push prices to WooCommerce for product #{$product->id}.");
        }

        return 1;
    }

    /**
     * @param  Collection<int, ProductVariant>  $variants
     */
    private function pushVariableProduct(WooCommerceIntegration $integration, Product $product, Collection $variants): int
    {
        $updates = $variants->map(function (ProductVariant $v) use ($integration, $product): array {
            $prices = $this->resolveWcPrices($v->regular_price ?? $product->regular_price, $v->sale_price ?? $product->sale_price);
            $effectiveSale = $prices['sale_price'] !== '' ? $prices['sale_price'] : $prices['regular_price'];
            EcommerceSyncEchoGuard::recordEcho(
                EcommercePlatform::WOOCOMMERCE,
                'variation_price',
                (int) $integration->user_id,
                (int) $v->wc_variation_id,
                EcommerceSyncEchoGuard::priceFingerprint($prices['regular_price'], $effectiveSale)
            );

            return ['id' => (int) $v->wc_variation_id, ...$prices];
        })->values()->all();

        EcommerceSyncEchoGuard::recordEcho(EcommercePlatform::WOOCOMMERCE, 'product_var_batch', (int) $integration->user_id, (int) $product->wc_product_id, 'pushed');

        if (!$this->apiClient->batchUpdateVariationPrices($integration, (int) $product->wc_product_id, $updates)) {
            throw new WooCommerceConnectionException("Failed to batch push variation prices to WooCommerce for product #{$product->id}.");
        }

        return count($updates);
    }

    private function tryPushSingle(WooCommerceIntegration $integration, Product $product): bool
    {
        try {
            return $this->pushProduct($integration, $product) > 0;
        } catch (\Throwable $e) {
            $integration->update(['last_error' => $e->getMessage()]);
            return false;
        }
    }
}
