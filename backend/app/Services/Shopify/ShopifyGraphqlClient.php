<?php

namespace App\Services\Shopify;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\ShopifyAuthMode;
use App\Exceptions\ShopifyConnectionException;
use App\Models\ShopifyIntegration;
use App\Support\ShopifyGid;
use Illuminate\Support\Facades\Http;

class ShopifyGraphqlClient implements ShopifyGraphqlClientInterface
{
    public function __construct(
        protected ShopifyAuthService $authService
    ) {}

    public function query(ShopifyIntegration $integration, string $query, array $variables = []): array
    {
        $token = $this->authService->ensureValidAccessToken($integration);
        $response = $this->sendGraphqlRequest($integration, $token, $query, $variables);

        if ($response->status() === 401 && $integration->auth_mode === ShopifyAuthMode::CLIENT_CREDENTIALS) {
            $token = $this->authService->ensureValidAccessToken($integration, true);
            $response = $this->sendGraphqlRequest($integration, $token, $query, $variables);
        }

        return $this->extractGraphqlData($response);
    }

    public function testConnection(ShopifyIntegration $integration): ?array
    {
        try {
            $data = $this->query($integration, ShopifyGraphqlQueries::SHOP_INFO);

            return $data['shop'] ?? null;
        } catch (\Throwable) {
            return null;
        }
    }

    public function getLocations(ShopifyIntegration $integration): array
    {
        $data = $this->query($integration, ShopifyGraphqlQueries::LOCATIONS);

        return collect($data['locations']['edges'] ?? [])->map(function (array $edge) {
            $node = $edge['node'] ?? [];

            return [
                'id' => ShopifyGid::extractId($node['id'] ?? null) ?? 0,
                'gid' => (string) ($node['id'] ?? ''),
                'name' => (string) ($node['name'] ?? 'Default Location'),
                'is_active' => (bool) ($node['isActive'] ?? true),
            ];
        })->filter(fn ($loc) => $loc['id'] > 0)->values()->all();
    }

    public function getProductsPage(ShopifyIntegration $integration, ?string $cursor = null, int $first = 50): array
    {
        $data = $this->query($integration, ShopifyGraphqlQueries::PRODUCTS_PAGE, ['first' => $first, 'after' => $cursor]);
        $conn = $data['products'] ?? [];

        return [
            'products' => collect($conn['edges'] ?? [])->pluck('node')->filter()->values()->all(),
            'has_next_page' => (bool) ($conn['pageInfo']['hasNextPage'] ?? false),
            'end_cursor' => $conn['pageInfo']['endCursor'] ?? null,
        ];
    }

    public function setInventoryQuantities(ShopifyIntegration $integration, array $quantities, string $idempotencyKey): array
    {
        $payload = $this->query($integration, ShopifyGraphqlQueries::SET_INVENTORY_QUANTITIES, [
            'idempotencyKey' => $idempotencyKey,
            'input' => ['name' => 'available', 'reason' => 'correction', 'quantities' => $quantities],
        ]);
        $result = $payload['inventorySetQuantities'] ?? [];
        $this->assertNoUserErrors($result['userErrors'] ?? [], 'فشل تحديث رصيد المخزون على Shopify');

        return $result;
    }

    public function getOrdersPage(ShopifyIntegration $integration, ?string $cursor = null, int $first = 25, ?string $queryFilter = null): array
    {
        $data = $this->query($integration, ShopifyGraphqlQueries::ORDERS_PAGE, [
            'first' => $first, 'after' => $cursor, 'query' => $queryFilter,
        ]);
        $conn = $data['orders'] ?? [];

        return [
            'orders' => collect($conn['edges'] ?? [])->pluck('node')->filter()->values()->all(),
            'has_next_page' => (bool) ($conn['pageInfo']['hasNextPage'] ?? false),
            'end_cursor' => $conn['pageInfo']['endCursor'] ?? null,
        ];
    }

    public function getOrderFulfillmentOrders(ShopifyIntegration $integration, string $orderGid): array
    {
        $data = $this->query($integration, ShopifyGraphqlQueries::ORDER_FULFILLMENT_ORDERS, ['id' => $orderGid]);

        return collect($data['order']['fulfillmentOrders']['edges'] ?? [])->pluck('node')->filter()->values()->all();
    }

    public function createFulfillment(ShopifyIntegration $integration, array $fulfillmentInput): array
    {
        $data = $this->query($integration, ShopifyGraphqlQueries::CREATE_FULFILLMENT, ['fulfillment' => $fulfillmentInput]);
        $result = $data['fulfillmentCreate'] ?? [];
        $this->assertNoUserErrors($result['userErrors'] ?? [], 'فشل إرسال حالة الشحن والتسليم إلى Shopify');

        return $result;
    }

    public function registerWebhooks(ShopifyIntegration $integration, string $callbackUrl, array $topics): bool
    {
        foreach ($topics as $topic) {
            $data = $this->query($integration, ShopifyGraphqlQueries::REGISTER_WEBHOOK, [
                'topic' => $topic,
                'webhookSubscription' => ['uri' => $callbackUrl, 'format' => 'JSON'],
            ]);
            $errors = $data['webhookSubscriptionCreate']['userErrors'] ?? [];
            if (!empty($errors) && !$this->isAlreadyRegisteredError($errors)) {
                return false;
            }
        }

        return true;
    }

    private function sendGraphqlRequest(ShopifyIntegration $integration, string $token, string $query, array $variables)
    {
        $version = (string) config('services.shopify.api_version', '2026-04');
        $url = "https://{$integration->shop_domain}/admin/api/{$version}/graphql.json";

        return Http::timeout(30)
            ->withHeaders(['X-Shopify-Access-Token' => $token, 'Content-Type' => 'application/json'])
            ->post($url, ['query' => $query, 'variables' => empty($variables) ? (object) [] : $variables]);
    }

    private function extractGraphqlData($response): array
    {
        if (!$response->successful()) {
            throw new ShopifyConnectionException("فشل اتصال Shopify GraphQL (HTTP {$response->status()}).", 422);
        }

        $json = $response->json() ?? [];
        if (!empty($json['errors'])) {
            $msg = (string) ($json['errors'][0]['message'] ?? 'Shopify GraphQL error');
            throw new ShopifyConnectionException("خطأ في استعلام Shopify: {$msg}", 422);
        }

        return (array) ($json['data'] ?? []);
    }

    private function assertNoUserErrors(array $userErrors, string $prefix): void
    {
        if (!empty($userErrors)) {
            $msg = (string) ($userErrors[0]['message'] ?? 'Unknown userError');
            throw new ShopifyConnectionException("{$prefix}: {$msg}", 422);
        }
    }

    private function isAlreadyRegisteredError(array $userErrors): bool
    {
        $msg = strtolower((string) ($userErrors[0]['message'] ?? ''));

        return str_contains($msg, 'already been taken') || str_contains($msg, 'already exists');
    }
}
