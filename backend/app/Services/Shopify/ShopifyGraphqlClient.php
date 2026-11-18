<?php

namespace App\Services\Shopify;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\ShopifyAuthMode;
use App\Exceptions\ShopifyConnectionException;
use App\Models\ShopifyIntegration;
use App\Support\ShopifyGid;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class ShopifyGraphqlClient implements ShopifyGraphqlClientInterface
{
    public function __construct(
        protected ShopifyAuthService $authService
    ) {}

    public function query(ShopifyIntegration $integration, string $query, array $variables = []): array
    {
        $token = $this->authService->ensureValidAccessToken($integration);
        $response = $this->executeWithRetry($integration, $token, $query, $variables);

        if ($response->status() === 401 && $integration->auth_mode === ShopifyAuthMode::CLIENT_CREDENTIALS) {
            $token = $this->authService->ensureValidAccessToken($integration, true);
            $response = $this->executeWithRetry($integration, $token, $query, $variables);
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
                'fulfills_online_orders' => (bool) ($node['fulfillsOnlineOrders'] ?? true),
            ];
        })->filter(fn ($loc) => $loc['id'] > 0)->values()->all();
    }

    public function getProductsPage(ShopifyIntegration $integration, ?string $cursor = null, int $first = 25): array
    {
        $data = $this->query($integration, ShopifyGraphqlQueries::PRODUCTS_PAGE, ['first' => $first, 'after' => $cursor]);
        $conn = $data['products'] ?? [];

        return [
            'products' => collect($conn['edges'] ?? [])->pluck('node')->filter()->values()->all(),
            'has_next_page' => (bool) ($conn['pageInfo']['hasNextPage'] ?? false),
            'end_cursor' => $conn['pageInfo']['endCursor'] ?? null,
        ];
    }

    public function getProductVariantsPage(ShopifyIntegration $integration, string $productGid, ?string $cursor = null, int $first = 50): array
    {
        $data = $this->query($integration, ShopifyGraphqlQueries::PRODUCT_VARIANTS_PAGE, [
            'id' => $productGid, 'first' => $first, 'after' => $cursor,
        ]);
        $conn = $data['product']['variants'] ?? [];

        return [
            'variants' => collect($conn['edges'] ?? [])->pluck('node')->filter()->values()->all(),
            'has_next_page' => (bool) ($conn['pageInfo']['hasNextPage'] ?? false),
            'end_cursor' => $conn['pageInfo']['endCursor'] ?? null,
        ];
    }

    public function getProductById(ShopifyIntegration $integration, string $productGid): ?array
    {
        $data = $this->query($integration, ShopifyGraphqlQueries::PRODUCT_BY_ID, ['id' => $productGid]);

        return !empty($data['product']) && is_array($data['product']) ? $data['product'] : null;
    }

    public function setInventoryQuantities(
        ShopifyIntegration $integration,
        array $quantities,
        string $idempotencyKey,
        ?string $referenceDocumentUri = null
    ): array {
        $input = ['name' => 'available', 'reason' => 'correction', 'quantities' => $quantities];
        if ($referenceDocumentUri) {
            $input['referenceDocumentUri'] = $referenceDocumentUri;
        }
        $payload = $this->query($integration, ShopifyGraphqlQueries::SET_INVENTORY_QUANTITIES, [
            'idempotencyKey' => $idempotencyKey,
            'input' => $input,
        ]);
        $result = $payload['inventorySetQuantities'] ?? [];
        $this->assertNoUserErrors($result['userErrors'] ?? [], 'فشل تحديث رصيد المخزون على Shopify');

        return $result;
    }

    public function activateInventory(ShopifyIntegration $integration, string $inventoryItemGid, string $locationGid): array
    {
        $payload = $this->query($integration, ShopifyGraphqlQueries::INVENTORY_ACTIVATE, [
            'inventoryItemId' => $inventoryItemGid,
            'locationId' => $locationGid,
        ]);
        $result = $payload['inventoryActivate'] ?? [];
        $this->assertNoUserErrors($result['userErrors'] ?? [], 'فشل تفعيل المخزون في الموقع على Shopify');

        return $result;
    }

    public function getOrdersPage(ShopifyIntegration $integration, ?string $cursor = null, int $first = 25, ?string $queryFilter = null): array
    {
        $vars = ['first' => $first, 'after' => $cursor, 'query' => $queryFilter];
        try {
            $data = $this->query($integration, ShopifyGraphqlQueries::ORDERS_PAGE, $vars);
        } catch (ShopifyConnectionException $e) {
            if (!$this->isPiiAccessDenied($e->getMessage())) {
                throw $e;
            }
            $integration->update(['last_error' => 'تنبيه صلاحيات Shopify (PCD): تم جلب الطلبات بدون بيانات العملاء الحساسة (الهاتف/الإيميل).']);
            $data = $this->query($integration, ShopifyGraphqlQueries::ORDERS_PAGE_NO_PII, $vars);
        }
        $conn = $data['orders'] ?? [];

        return [
            'orders' => collect($conn['edges'] ?? [])->pluck('node')->filter()->values()->all(),
            'has_next_page' => (bool) ($conn['pageInfo']['hasNextPage'] ?? false),
            'end_cursor' => $conn['pageInfo']['endCursor'] ?? null,
        ];
    }

    public function getOrderById(ShopifyIntegration $integration, string $orderGid): ?array
    {
        $data = $this->query($integration, ShopifyGraphqlQueries::ORDER_BY_ID, ['id' => $orderGid]);

        return !empty($data['order']) && is_array($data['order']) ? $data['order'] : null;
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

    public function cancelOrder(
        ShopifyIntegration $integration,
        string $orderGid,
        string $reason,
        bool $restock,
        ?string $staffNote = null
    ): array {
        $data = $this->query($integration, ShopifyGraphqlQueries::ORDER_CANCEL, [
            'orderId' => $orderGid, 'reason' => $reason, 'notifyCustomer' => false,
            'restock' => $restock, 'staffNote' => $staffNote,
        ]);
        $result = $data['orderCancel'] ?? [];
        $errors = $result['orderCancelUserErrors'] ?? [];
        if (!empty($errors) && !$this->isAlreadyCancelledError($errors)) {
            $this->assertNoUserErrors($errors, 'فشل إلغاء الطلب على Shopify');
        }

        return $result;
    }

    public function registerWebhooks(ShopifyIntegration $integration, string $callbackUrl, array $topics): bool
    {
        $allOk = true;
        foreach ($topics as $topic) {
            $data = $this->query($integration, ShopifyGraphqlQueries::REGISTER_WEBHOOK, [
                'topic' => $topic,
                'webhookSubscription' => ['uri' => $callbackUrl, 'format' => 'JSON'],
            ]);
            $errors = $data['webhookSubscriptionCreate']['userErrors'] ?? [];
            if (!empty($errors) && !$this->isAlreadyRegisteredError($errors)) {
                $allOk = false;
            }
        }

        return $allOk;
    }

    private function executeWithRetry(ShopifyIntegration $integration, string $token, string $query, array $variables): Response
    {
        $attempts = 0;
        do {
            $response = $this->sendGraphqlRequest($integration, $token, $query, $variables);
            $attempts++;
            $shouldRetry = $this->shouldRetryResponse($response) && $attempts < 3;
            if ($shouldRetry) {
                usleep($this->computeRetryDelayMicros($response));
            }
        } while ($shouldRetry);

        return $response;
    }

    private function sendGraphqlRequest(ShopifyIntegration $integration, string $token, string $query, array $variables): Response
    {
        $version = (string) config('services.shopify.api_version', '2026-10');
        $url = "https://{$integration->shop_domain}/admin/api/{$version}/graphql.json";

        return Http::timeout(30)
            ->withHeaders(['X-Shopify-Access-Token' => $token, 'Content-Type' => 'application/json'])
            ->post($url, ['query' => $query, 'variables' => empty($variables) ? (object) [] : $variables]);
    }

    private function extractGraphqlData(Response $response): array
    {
        if (!$response->successful()) {
            throw new ShopifyConnectionException("فشل اتصال Shopify GraphQL (HTTP {$response->status()}).", 422);
        }
        $json = $response->json() ?? [];
        if (!empty($json['errors'])) {
            $msg = (string) ($json['errors'][0]['message'] ?? 'Shopify GraphQL error');
            throw new ShopifyConnectionException("خطأ في استعلام Shopify: {$msg}", 422);
        }
        $this->paceCostBudget($json);

        return (array) ($json['data'] ?? []);
    }

    private function shouldRetryResponse(Response $response): bool
    {
        if (in_array($response->status(), [429, 502, 503, 504], true)) {
            return true;
        }
        $errors = $response->json('errors') ?? [];

        return is_array($errors) && ($errors[0]['extensions']['code'] ?? '') === 'THROTTLED';
    }

    private function computeRetryDelayMicros(Response $response): int
    {
        $retryAfter = (int) ($response->header('Retry-After') ?? 1);

        return max(300_000, min($retryAfter, 5) * 1_000_000);
    }

    private function paceCostBudget(array $json): void
    {
        $available = (int) ($json['extensions']['cost']['throttleStatus']['currentlyAvailable'] ?? 1000);
        if ($available < 150) {
            usleep(500_000);
        }
    }

    private function isPiiAccessDenied(string $message): bool
    {
        $lower = strtolower($message);

        return str_contains($lower, 'protected customer data') || str_contains($lower, 'not approved to access');
    }

    private function assertNoUserErrors(array $userErrors, string $prefix): void
    {
        if (!empty($userErrors)) {
            $msg = (string) ($userErrors[0]['message'] ?? 'Unknown userError');
            throw new ShopifyConnectionException("{$prefix}: {$msg}", 422, array_values($userErrors));
        }
    }

    private function isAlreadyRegisteredError(array $userErrors): bool
    {
        $msg = strtolower((string) ($userErrors[0]['message'] ?? ''));

        return str_contains($msg, 'already been taken') || str_contains($msg, 'already exists');
    }

    private function isAlreadyCancelledError(array $userErrors): bool
    {
        $msg = strtolower((string) ($userErrors[0]['message'] ?? ''));

        return str_contains($msg, 'already cancel');
    }
}
