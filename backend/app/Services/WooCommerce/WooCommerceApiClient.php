<?php

namespace App\Services\WooCommerce;

use App\Contracts\WooCommerceApiClientInterface;
use App\Models\WooCommerceIntegration;
use Exception;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WooCommerceApiClient implements WooCommerceApiClientInterface
{
    /**
     * Test connection to WooCommerce REST API using System Status endpoint
     */
    public function testConnection(WooCommerceIntegration $config): bool
    {
        try {
            $url = rtrim($config->store_url, '/') . '/wp-json/wc/v3/system_status';
            $response = Http::timeout(15)
                ->withBasicAuth($config->consumer_key, $config->consumer_secret)
                ->get($url);

            return $response->successful();
        } catch (Exception $e) {
            Log::warning("WooCommerce connection test failed: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Get products from WooCommerce with pagination
     */
    public function getProducts(WooCommerceIntegration $config, int $page = 1, int $perPage = 50, string $status = 'publish'): array
    {
        try {
            $url = rtrim($config->store_url, '/') . '/wp-json/wc/v3/products';
            $response = Http::timeout(30)
                ->withBasicAuth($config->consumer_key, $config->consumer_secret)
                ->get($url, [
                    'page' => $page,
                    'per_page' => $perPage,
                    'status' => $status,
                ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::error("WooCommerce getProducts failed: " . $response->body());
            return [];
        } catch (Exception $e) {
            Log::error("WooCommerce getProducts exception: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Get single product with variations
     */
    public function getProduct(WooCommerceIntegration $config, int $wcProductId): ?array
    {
        try {
            $url = rtrim($config->store_url, '/') . "/wp-json/wc/v3/products/{$wcProductId}";
            $response = Http::timeout(20)
                ->withBasicAuth($config->consumer_key, $config->consumer_secret)
                ->get($url);

            return $response->successful() ? $response->json() : null;
        } catch (Exception $e) {
            Log::error("WooCommerce getProduct exception: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Get variations for a variable product
     */
    public function getProductVariations(WooCommerceIntegration $config, int $wcProductId): array
    {
        try {
            $url = rtrim($config->store_url, '/') . "/wp-json/wc/v3/products/{$wcProductId}/variations";
            $response = Http::timeout(30)
                ->withBasicAuth($config->consumer_key, $config->consumer_secret)
                ->get($url, ['per_page' => 100]);

            return $response->successful() ? $response->json() : [];
        } catch (Exception $e) {
            Log::error("WooCommerce getProductVariations exception: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Update stock quantity of a simple product
     */
    public function updateProductStock(WooCommerceIntegration $config, int $wcProductId, float $qty): bool
    {
        try {
            $url = rtrim($config->store_url, '/') . "/wp-json/wc/v3/products/{$wcProductId}";
            $response = Http::timeout(15)
                ->withBasicAuth($config->consumer_key, $config->consumer_secret)
                ->put($url, [
                    'manage_stock' => true,
                    'stock_quantity' => (int) $qty,
                ]);

            return $response->successful();
        } catch (Exception $e) {
            Log::error("WooCommerce updateProductStock exception: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Update stock quantity of a variation
     */
    public function updateVariationStock(WooCommerceIntegration $config, int $wcProductId, int $wcVariationId, float $qty): bool
    {
        return $this->sendPutBool($config, "products/{$wcProductId}/variations/{$wcVariationId}", [
            'manage_stock' => true,
            'stock_quantity' => (int) $qty,
        ], 'updateVariationStock');
    }

    public function updateProductPrices(WooCommerceIntegration $config, int $wcProductId, string $regularPrice, string $salePrice): bool
    {
        return $this->sendPutBool($config, "products/{$wcProductId}", [
            'regular_price' => $regularPrice,
            'sale_price' => $salePrice,
        ], 'updateProductPrices');
    }

    public function updateVariationPrices(WooCommerceIntegration $config, int $wcProductId, int $wcVariationId, string $regularPrice, string $salePrice): bool
    {
        return $this->sendPutBool($config, "products/{$wcProductId}/variations/{$wcVariationId}", [
            'regular_price' => $regularPrice,
            'sale_price' => $salePrice,
        ], 'updateVariationPrices');
    }

    public function batchUpdateVariationPrices(WooCommerceIntegration $config, int $wcProductId, array $updates): bool
    {
        if (empty($updates)) {
            return true;
        }
        foreach (array_chunk($updates, 50) as $chunk) {
            if ($this->sendRequest($config, 'post', "products/{$wcProductId}/variations/batch", ['update' => $chunk], 'batchUpdateVariationPrices', 30) === null) {
                return false;
            }
        }

        return true;
    }

    public function getCoupons(WooCommerceIntegration $config, int $page = 1, int $perPage = 50): array
    {
        $res = $this->sendRequest($config, 'get', 'coupons', ['page' => $page, 'per_page' => $perPage], 'getCoupons', 25);

        return is_array($res) ? $res : [];
    }

    public function createCoupon(WooCommerceIntegration $config, array $data): ?array
    {
        return $this->sendRequest($config, 'post', 'coupons', $data, 'createCoupon', 20);
    }

    public function updateCoupon(WooCommerceIntegration $config, int $wcCouponId, array $data): ?array
    {
        return $this->sendRequest($config, 'put', "coupons/{$wcCouponId}", $data, 'updateCoupon', 20);
    }

    public function deleteCoupon(WooCommerceIntegration $config, int $wcCouponId): bool
    {
        return $this->sendRequest($config, 'delete', "coupons/{$wcCouponId}?force=true", [], 'deleteCoupon', 15) !== null;
    }

    /**
     * Get customers list
     */
    public function getCustomers(WooCommerceIntegration $config, int $page = 1, int $perPage = 50): array
    {
        try {
            $url = rtrim($config->store_url, '/') . '/wp-json/wc/v3/customers';
            $response = Http::timeout(20)
                ->withBasicAuth($config->consumer_key, $config->consumer_secret)
                ->get($url, [
                    'page' => $page,
                    'per_page' => $perPage,
                ]);

            return $response->successful() ? $response->json() : [];
        } catch (Exception $e) {
            Log::error("WooCommerce getCustomers exception: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Create customer on WooCommerce
     */
    public function createCustomer(WooCommerceIntegration $config, array $data): ?array
    {
        try {
            $url = rtrim($config->store_url, '/') . '/wp-json/wc/v3/customers';
            $response = Http::timeout(20)
                ->withBasicAuth($config->consumer_key, $config->consumer_secret)
                ->post($url, $data);

            return $response->successful() ? $response->json() : null;
        } catch (Exception $e) {
            Log::error("WooCommerce createCustomer exception: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Update customer on WooCommerce
     */
    public function updateCustomer(WooCommerceIntegration $config, int $wcCustomerId, array $data): bool
    {
        try {
            $url = rtrim($config->store_url, '/') . "/wp-json/wc/v3/customers/{$wcCustomerId}";
            $response = Http::timeout(20)
                ->withBasicAuth($config->consumer_key, $config->consumer_secret)
                ->put($url, $data);

            return $response->successful();
        } catch (Exception $e) {
            Log::error("WooCommerce updateCustomer exception: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Get recent orders
     */
    public function getOrders(WooCommerceIntegration $config, string $status = 'processing', int $page = 1, int $perPage = 20): array
    {
        try {
            $url = rtrim($config->store_url, '/') . '/wp-json/wc/v3/orders';
            $response = Http::timeout(25)
                ->withBasicAuth($config->consumer_key, $config->consumer_secret)
                ->get($url, [
                    'status' => $status,
                    'page' => $page,
                    'per_page' => $perPage,
                ]);

            return $response->successful() ? $response->json() : [];
        } catch (Exception $e) {
            Log::error("WooCommerce getOrders exception: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Update order status on WooCommerce
     */
    public function updateOrderStatus(WooCommerceIntegration $config, int $wcOrderId, string $status): bool
    {
        try {
            $url = rtrim($config->store_url, '/') . "/wp-json/wc/v3/orders/{$wcOrderId}";
            $response = Http::timeout(15)
                ->withBasicAuth($config->consumer_key, $config->consumer_secret)
                ->put($url, [
                    'status' => $status,
                ]);

            return $response->successful();
        } catch (Exception $e) {
            Log::error("WooCommerce updateOrderStatus exception: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Get the store currency from WooCommerce settings
     */
    public function getStoreCurrency(WooCommerceIntegration $config): string
    {
        try {
            $url = rtrim($config->store_url, '/') . '/wp-json/wc/v3/settings/general/woocommerce_currency';
            $response = Http::timeout(15)
                ->withBasicAuth($config->consumer_key, $config->consumer_secret)
                ->get($url);

            if ($response->successful() && !empty($response->json('value'))) {
                $code = strtoupper((string) $response->json('value'));
                return $code === 'EGP' ? 'ج.م' : $code;
            }

            // Fallback to system_status
            $statusUrl = rtrim($config->store_url, '/') . '/wp-json/wc/v3/system_status';
            $statusResp = Http::timeout(15)
                ->withBasicAuth($config->consumer_key, $config->consumer_secret)
                ->get($statusUrl);

            if ($statusResp->successful()) {
                $currency = $statusResp->json('environment.currency') ?? 'EGP';
                return $currency === 'EGP' ? 'ج.م' : $currency;
            }

            return 'ج.م';
        } catch (Exception $e) {
            Log::warning("WooCommerce getStoreCurrency exception: " . $e->getMessage());
            return 'ج.م';
        }
    }

    /**
     * Automatically register order webhooks in WooCommerce via REST API
     */
    public function registerWebhooks(WooCommerceIntegration $config): bool
    {
        try {
            $deliveryUrl = url("/api/webhooks/woocommerce/{$config->user_id}");
            $webhooksUrl = rtrim($config->store_url, '/') . '/wp-json/wc/v3/webhooks';
            $listResp = Http::timeout(15)->withBasicAuth($config->consumer_key, $config->consumer_secret)->get($webhooksUrl, ['per_page' => 100]);
            $existing = $listResp->successful() ? (array) $listResp->json() : [];

            $this->ensureWebhookTopic($config, $webhooksUrl, $deliveryUrl, $existing, 'order.created', 'إنجاز برو - مزامنة الطلبيات اللحظية');
            $this->ensureWebhookTopic($config, $webhooksUrl, $deliveryUrl, $existing, 'order.updated', 'إنجاز برو - تحديث الطلبيات');
            $this->ensureWebhookTopic($config, $webhooksUrl, $deliveryUrl, $existing, 'product.updated', 'إنجاز برو - تحديث أسعار ومنتجات المتجر');
            $this->ensureWebhookTopic($config, $webhooksUrl, $deliveryUrl, $existing, 'coupon.created', 'إنجاز برو - مزامنة كوبونات المتجر (إنشاء)');
            $this->ensureWebhookTopic($config, $webhooksUrl, $deliveryUrl, $existing, 'coupon.updated', 'إنجاز برو - مزامنة كوبونات المتجر (تحديث)');
            $this->ensureWebhookTopic($config, $webhooksUrl, $deliveryUrl, $existing, 'coupon.deleted', 'إنجاز برو - مزامنة كوبونات المتجر (حذف)');

            return true;
        } catch (Exception $e) {
            Log::warning("WooCommerce registerWebhooks exception for store #{$config->user_id}: " . $e->getMessage());
            return false;
        }
    }

    private function sendPutBool(WooCommerceIntegration $config, string $path, array $payload, string $context): bool
    {
        return $this->sendRequest($config, 'put', $path, $payload, $context, 15) !== null;
    }

    private function sendRequest(WooCommerceIntegration $config, string $method, string $path, array $payload, string $context, int $timeout = 20): ?array
    {
        try {
            $url = rtrim($config->store_url, '/') . '/wp-json/wc/v3/' . ltrim($path, '/');
            $req = Http::timeout($timeout)->withBasicAuth($config->consumer_key, $config->consumer_secret);
            $response = $req->{$method}($url, $payload);
            if ($response->successful()) {
                return is_array($response->json()) ? $response->json() : [];
            }
            Log::warning("WooCommerce {$context} failed ({$response->status()}): " . $response->body());
            return null;
        } catch (Exception $e) {
            Log::error("WooCommerce {$context} exception: " . $e->getMessage());
            return null;
        }
    }

    private function ensureWebhookTopic(WooCommerceIntegration $config, string $webhooksUrl, string $deliveryUrl, array $existing, string $topic, string $name): void
    {
        foreach ($existing as $wh) {
            if (($wh['delivery_url'] ?? '') === $deliveryUrl && ($wh['topic'] ?? '') === $topic) {
                if (($wh['status'] ?? '') !== 'active' && !empty($wh['id'])) {
                    Http::timeout(10)->withBasicAuth($config->consumer_key, $config->consumer_secret)->put("{$webhooksUrl}/{$wh['id']}", ['status' => 'active']);
                }
                return;
            }
        }

        $resp = Http::timeout(15)->withBasicAuth($config->consumer_key, $config->consumer_secret)->post($webhooksUrl, [
            'name' => $name, 'topic' => $topic, 'delivery_url' => $deliveryUrl, 'secret' => $config->webhook_secret, 'status' => 'active',
        ]);
        if ($topic === 'order.created' && !$resp->successful()) {
            Log::warning("Failed to auto-register order.created webhook for store #{$config->user_id}: " . $resp->body());
        }
    }
}

