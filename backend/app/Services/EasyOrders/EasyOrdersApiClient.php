<?php

namespace App\Services\EasyOrders;

use App\Contracts\EasyOrdersApiClientInterface;
use App\Exceptions\EasyOrdersConnectionException;
use App\Models\EasyOrdersIntegration;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class EasyOrdersApiClient implements EasyOrdersApiClientInterface
{
    public function testConnection(EasyOrdersIntegration $integration): bool
    {
        $this->request($integration, 'get', 'products', ['limit' => 1, 'page' => 1]);

        return true;
    }

    public function getProductsPage(EasyOrdersIntegration $integration, int $page = 1, int $limit = 20): array
    {
        $query = ['join' => 'Variations.Props,Variants.VariationProps', 'page' => $page, 'limit' => $limit];
        $raw = $this->request($integration, 'get', 'products', $query);

        return $this->extractPaginatedList($raw, 'products', $page, $limit);
    }

    public function getOrdersPage(EasyOrdersIntegration $integration, int $page = 1, int $limit = 20, ?string $status = null): array
    {
        $query = ['sort' => 'created_at,DESC', 'page' => $page, 'limit' => $limit];
        if ($status !== null && $status !== '') {
            $query['filter'] = "status||eq||{$status}";
        }
        $raw = $this->request($integration, 'get', 'orders', $query);

        return $this->extractPaginatedList($raw, 'orders', $page, $limit);
    }

    public function getOrderById(EasyOrdersIntegration $integration, string $orderId): array
    {
        return $this->request($integration, 'get', 'orders/' . urlencode($orderId));
    }

    public function updateOrderStatus(EasyOrdersIntegration $integration, string $orderId, string $status): array
    {
        return $this->request($integration, 'patch', 'orders/' . urlencode($orderId) . '/status', ['status' => $status]);
    }

    public function updateProductStockBySku(EasyOrdersIntegration $integration, string $sku, int $quantity): array
    {
        return $this->request($integration, 'patch', 'products/sku/' . rawurlencode($sku) . '/quantity', ['quantity' => max(0, $quantity)]);
    }

    public function updateVariantStock(EasyOrdersIntegration $integration, string $productCode, string $variantCode, int $quantity): array
    {
        $path = 'products/variants/' . rawurlencode($productCode) . '/' . rawurlencode($variantCode) . '/quantity';

        return $this->request($integration, 'patch', $path, ['quantity' => max(0, $quantity)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function request(EasyOrdersIntegration $integration, string $method, string $path, array $payload = []): array
    {
        $url = rtrim((string) config('services.easyorders.api_base_url', 'https://api.easy-orders.net/api/v1/external-apps'), '/') . '/' . ltrim($path, '/');

        try {
            /** @var Response $response */
            $response = $this->httpClient($integration)->{$method}($url, $payload);
        } catch (\Throwable $e) {
            throw new EasyOrdersConnectionException('تعذر الاتصال بخادم EasyOrders: ' . $e->getMessage(), 502);
        }

        if (!$response->successful()) {
            $this->throwResponseException($response);
        }

        $decoded = $response->json();

        return is_array($decoded) ? $decoded : [];
    }

    private function httpClient(EasyOrdersIntegration $integration): PendingRequest
    {
        $apiKey = trim((string) $integration->api_key);
        if ($apiKey === '') {
            throw new EasyOrdersConnectionException('مفتاح Api-Key لمتجر EasyOrders غير مُعد بعد.', 422);
        }

        return Http::timeout(20)->acceptJson()->withHeaders(['Api-Key' => $apiKey]);
    }

    private function throwResponseException(Response $response): never
    {
        $status = $response->status();
        if ($status === 429) {
            $retry = max(15, (int) ($response->header('Retry-After') ?? 60));
            throw new EasyOrdersConnectionException('تم تجاوز حد طلبات EasyOrders (40 طلب/دقيقة). سيتم إعادة المحاولة تلقائياً.', 429, $retry);
        }

        $msg = (string) ($response->json('message') ?? $response->body());
        throw new EasyOrdersConnectionException("خطأ من EasyOrders ({$status}): " . mb_substr($msg, 0, 180), $status >= 400 && $status < 500 ? $status : 422);
    }

    /**
     * @return array{products?: list<array<string, mixed>>, orders?: list<array<string, mixed>>, has_next_page: bool, page_count: int}
     */
    private function extractPaginatedList(array $raw, string $key, int $page, int $limit): array
    {
        $items = isset($raw['data']) && is_array($raw['data']) ? array_values($raw['data']) : (array_is_list($raw) ? $raw : []);
        $pageCount = (int) ($raw['pageCount'] ?? 0);
        $hasNext = $pageCount > 0 ? $page < $pageCount : count($items) >= $limit;

        return [$key => $items, 'has_next_page' => $hasNext, 'page_count' => $pageCount];
    }
}
