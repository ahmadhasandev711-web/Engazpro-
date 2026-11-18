<?php

namespace App\Jobs;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\EcommercePlatform;
use App\Enums\QueueName;
use App\Models\ShopifyIntegration;
use App\Models\User;
use App\Services\OnlineOrders\OnlineOrderIngestionService;
use App\Services\Shopify\ShopifyProductImportService;
use App\Services\Shopify\ShopifySettingsService;
use App\Support\ShopifyGid;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessShopifyWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 45;
    public array $backoff = [15, 60];

    public function __construct(
        public int $userId,
        public string $topic,
        public array $payload
    ) {
        $this->onQueue(QueueName::SHOPIFY_REALTIME->value);
    }

    public function handle(
        OnlineOrderIngestionService $ingestionService,
        ShopifyGraphqlClientInterface $graphqlClient,
        ShopifyProductImportService $productImportService,
        ShopifySettingsService $settingsService
    ): void {
        $user = User::withoutGlobalScopes()->findOrFail($this->userId);
        $integration = ShopifyIntegration::withoutGlobalScopes()
            ->where('user_id', $this->userId)
            ->where('is_active', true)
            ->first();

        match (true) {
            str_starts_with($this->topic, 'orders/') => $this->handleOrderWebhook($user, $integration, $ingestionService, $graphqlClient),
            str_starts_with($this->topic, 'refunds/') => $this->handleRefundWebhook($user, $integration, $ingestionService, $graphqlClient),
            str_starts_with($this->topic, 'products/') => $this->handleProductWebhook($user, $integration, $productImportService, $graphqlClient),
            str_starts_with($this->topic, 'locations/') => $this->handleLocationWebhook($integration, $settingsService),
            default => null,
        };
    }

    private function handleOrderWebhook(
        User $user,
        ?ShopifyIntegration $integration,
        OnlineOrderIngestionService $ingestionService,
        ShopifyGraphqlClientInterface $graphqlClient
    ): void {
        $payload = $this->payload;
        if ($integration && empty($payload['location_id']) && empty($payload['fulfillmentOrders']) && !empty($payload['id'])) {
            $payload = $this->enrichOrderFromGraphql($integration, $payload, $graphqlClient);
        }
        $ingestionService->ingest($user, EcommercePlatform::SHOPIFY, $payload);
    }

    private function enrichOrderFromGraphql(
        ShopifyIntegration $integration,
        array $payload,
        ShopifyGraphqlClientInterface $graphqlClient
    ): array {
        $orderGid = ShopifyGid::toGid('Order', (int) $payload['id']);
        try {
            $gqlOrder = $graphqlClient->getOrderById($integration, $orderGid);
            if ($gqlOrder) {
                return $gqlOrder;
            }
            $fulfillmentOrders = $graphqlClient->getOrderFulfillmentOrders($integration, $orderGid);
            if (!empty($fulfillmentOrders)) {
                $payload['location_id'] = ShopifyGid::extractId($fulfillmentOrders[0]['assignedLocation']['location']['id'] ?? null);
                $payload['fulfillmentOrders'] = ['edges' => array_map(fn ($node) => ['node' => $node], $fulfillmentOrders)];
            }
        } catch (\Throwable) {
            // Fall back cleanly to webhook payload if GraphQL lookup is temporarily unreachable.
        }

        return $payload;
    }

    private function handleRefundWebhook(
        User $user,
        ?ShopifyIntegration $integration,
        OnlineOrderIngestionService $ingestionService,
        ShopifyGraphqlClientInterface $graphqlClient
    ): void {
        $orderId = ShopifyGid::extractId($this->payload['order_id'] ?? null);
        if (!$integration || !$orderId) {
            return;
        }
        $gqlOrder = $graphqlClient->getOrderById($integration, ShopifyGid::toGid('Order', $orderId));
        if ($gqlOrder) {
            $ingestionService->ingest($user, EcommercePlatform::SHOPIFY, $gqlOrder);
        }
    }

    private function handleProductWebhook(
        User $user,
        ?ShopifyIntegration $integration,
        ShopifyProductImportService $productImportService,
        ShopifyGraphqlClientInterface $graphqlClient
    ): void {
        $productId = ShopifyGid::extractId($this->payload['id'] ?? ($this->payload['admin_graphql_api_id'] ?? null));
        if (!$integration || !$productId) {
            return;
        }
        $node = $graphqlClient->getProductById($integration, ShopifyGid::toGid('Product', $productId));
        if ($node) {
            $productImportService->syncSingleProduct($user, $integration, $node, importStock: false);
        }
    }

    private function handleLocationWebhook(?ShopifyIntegration $integration, ShopifySettingsService $settingsService): void
    {
        if ($integration) {
            $settingsService->syncLocations($integration);
        }
    }
}
