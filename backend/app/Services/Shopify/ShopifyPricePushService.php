<?php

namespace App\Services\Shopify;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\EcommercePlatform;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShopifyIntegration;
use App\Models\User;
use App\Services\EcommerceSyncEchoGuard;
use App\Support\Money;
use App\Support\ShopifyGid;
use Illuminate\Support\Collection;

class ShopifyPricePushService
{
    public function __construct(
        protected ShopifyGraphqlClientInterface $graphqlClient
    ) {}

    /**
     * @return array{price: string, compareAtPrice: ?string}
     */
    public function resolveShopifyPrices(mixed $regularPrice, mixed $salePrice): array
    {
        $reg = Money::of($regularPrice ?? 0);
        $sale = Money::of($salePrice ?? 0);

        if ($reg->isGreaterThan($sale) && $sale->isPositive()) {
            return ['price' => $sale->toDecimalString(), 'compareAtPrice' => $reg->toDecimalString()];
        }

        $effective = $sale->isPositive() ? $sale : $reg;

        return ['price' => $effective->toDecimalString(), 'compareAtPrice' => null];
    }

    public function pushProduct(ShopifyIntegration $integration, Product $product): int
    {
        if (empty($product->shopify_product_id)) {
            return 0;
        }
        $variantInputs = $this->collectVariantPriceInputs($product);
        if (empty($variantInputs)) {
            return 0;
        }

        EcommerceSyncEchoGuard::recordEcho(
            EcommercePlatform::SHOPIFY,
            'product_price',
            (int) $integration->user_id,
            (int) $product->shopify_product_id,
            self::fingerprintFromVariantInputs($variantInputs)
        );

        return $this->pushBulkChunks($integration, (int) $product->shopify_product_id, $variantInputs);
    }

    /**
     * @return array{synced_count: int, failed_count: int}
     */
    public function pushAll(User $user, ShopifyIntegration $integration): array
    {
        $synced = 0;
        $failed = 0;

        Product::withoutGlobalScopes()
            ->where('user_id', $integration->user_id)
            ->whereNotNull('shopify_product_id')
            ->with('variants')
            ->chunkById(50, function (Collection $products) use ($integration, &$synced, &$failed): void {
                foreach ($products as $product) {
                    $this->tryPushSingle($integration, $product) ? $synced++ : $failed++;
                }
            });

        return ['synced_count' => $synced, 'failed_count' => $failed];
    }

    /**
     * @param  list<array{id: string, price: string, compareAtPrice: ?string}>  $inputs
     */
    public static function fingerprintFromVariantInputs(array $inputs): string
    {
        $parts = array_map(function (array $row): string {
            $id = (string) ($row['id'] ?? '');
            $priceCents = Money::of($row['price'] ?? 0)->getCents();
            $compareCents = Money::of($row['compareAtPrice'] ?? 0)->getCents();

            return "{$id}:{$priceCents}:{$compareCents}";
        }, $inputs);
        sort($parts);

        return sha1(implode('|', $parts));
    }

    /**
     * @return list<array{id: string, price: string, compareAtPrice: ?string}>
     */
    private function collectVariantPriceInputs(Product $product): array
    {
        $variants = $product->relationLoaded('variants') ? $product->variants : $product->variants()->get();
        $linked = $variants->filter(fn (ProductVariant $v) => !empty($v->shopify_variant_id));

        if ($linked->isNotEmpty()) {
            return $linked->map(fn (ProductVariant $v) => [
                'id' => ShopifyGid::toGid('ProductVariant', (int) $v->shopify_variant_id),
                ...$this->resolveShopifyPrices($v->regular_price ?? $product->regular_price, $v->sale_price ?? $product->sale_price),
            ])->values()->all();
        }

        if (empty($product->shopify_variant_id)) {
            return [];
        }

        return [['id' => ShopifyGid::toGid('ProductVariant', (int) $product->shopify_variant_id), ...$this->resolveShopifyPrices($product->regular_price, $product->sale_price)]];
    }

    private function pushBulkChunks(ShopifyIntegration $integration, int $shopifyProductId, array $inputs): int
    {
        $productGid = ShopifyGid::toGid('Product', $shopifyProductId);
        $updated = 0;

        foreach (array_chunk($inputs, 100) as $chunk) {
            $this->graphqlClient->updateVariantPricesBulk($integration, $productGid, $chunk);
            $updated += count($chunk);
        }

        return $updated;
    }

    private function tryPushSingle(ShopifyIntegration $integration, Product $product): bool
    {
        try {
            return $this->pushProduct($integration, $product) > 0;
        } catch (\Throwable $e) {
            $integration->update(['last_error' => $e->getMessage()]);
            return false;
        }
    }
}
