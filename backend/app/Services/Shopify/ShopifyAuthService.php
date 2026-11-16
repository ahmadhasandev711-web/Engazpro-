<?php

namespace App\Services\Shopify;

use App\Enums\EcommercePlatform;
use App\Enums\ShopifyAuthMode;
use App\Exceptions\ShopifyConnectionException;
use App\Models\ShopifyIntegration;
use App\Models\User;
use App\Services\EcommerceAccessService;
use App\Support\ShopifyGid;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ShopifyAuthService
{
    public function __construct(
        protected EcommerceAccessService $ecommerceAccess
    ) {}
    public function ensureValidAccessToken(ShopifyIntegration $integration, bool $forceRefresh = false): string
    {
        $hasToken = !empty($integration->access_token);
        if ($integration->auth_mode !== ShopifyAuthMode::CLIENT_CREDENTIALS) {
            if (!$hasToken) {
                throw new ShopifyConnectionException('رمز الوصول (Access Token) غير متوفر لهذا المتجر.', 422);
            }

            return $integration->access_token;
        }

        $stillValid = $hasToken && !$forceRefresh && $integration->token_expires_at
            && $integration->token_expires_at->gt(now()->addMinutes(5));

        return $stillValid ? $integration->access_token : $this->exchangeClientCredentials($integration);
    }

    public function exchangeClientCredentials(ShopifyIntegration $integration): string
    {
        $clientId = $integration->client_id ?: config('services.shopify.client_id');
        $clientSecret = $integration->client_secret ?: config('services.shopify.client_secret');
        if (!$clientId || !$clientSecret || !$integration->shop_domain) {
            throw new ShopifyConnectionException('بيانات Client ID و Client Secret غير مكتملة لمتجر Shopify.', 422);
        }

        $response = Http::timeout(20)->asForm()->post("https://{$integration->shop_domain}/admin/oauth/access_token", [
            'client_id' => $clientId, 'client_secret' => $clientSecret, 'grant_type' => 'client_credentials',
        ]);
        if (!$response->successful() || empty($response->json('access_token'))) {
            throw new ShopifyConnectionException('فشل الحصول على رمز الوصول عبر Client Credentials من Shopify.', 422);
        }

        $expiresIn = (int) ($response->json('expires_in') ?? 86399);
        $integration->update([
            'access_token' => (string) $response->json('access_token'),
            'token_expires_at' => now()->addSeconds(max(300, $expiresIn)),
            'last_error' => null,
        ]);

        return $integration->access_token;
    }

    public function buildAuthorizeUrl(User $user, string $shopDomain, ?string $returnUrl = null): string
    {
        $accountId = $user->getAccountId();
        $this->ecommerceAccess->assertPlatformAllowed($accountId, EcommercePlatform::SHOPIFY);
        $normalizedShop = ShopifyGid::normalizeShopDomain($shopDomain);
        $integration = ShopifyIntegration::where('user_id', $accountId)->first();
        $clientId = $integration?->client_id ?: config('services.shopify.client_id');
        if (empty($clientId)) {
            throw new ShopifyConnectionException('معرف تطبيق Shopify (Client ID) غير مهيأ للربط عبر OAuth.', 422);
        }

        $state = Str::random(40);
        Cache::put("shopify_oauth_state_{$state}", [
            'account_id' => $accountId,
            'shop_domain' => $normalizedShop,
            'return_url' => $returnUrl ?: $this->defaultReturnUrl(),
        ], now()->addMinutes(15));

        $query = http_build_query([
            'client_id' => $clientId,
            'scope' => (string) config('services.shopify.scopes'),
            'redirect_uri' => url('/api/shopify/auth-callback'),
            'state' => $state,
        ]);

        return "https://{$normalizedShop}/admin/oauth/authorize?{$query}";
    }

    public function handleCallback(array $query): array
    {
        $statePayload = Cache::pull('shopify_oauth_state_' . ($query['state'] ?? ''));
        if (!$statePayload || empty($query['code']) || empty($query['shop'])) {
            throw new ShopifyConnectionException('بيانات التحقق الخاصة بربط Shopify OAuth غير صالحة أو منتهية الصلاحية.', 403);
        }

        $accountId = (int) $statePayload['account_id'];
        $this->ecommerceAccess->assertPlatformAllowed($accountId, EcommercePlatform::SHOPIFY);
        $shop = ShopifyGid::normalizeShopDomain((string) $query['shop']);
        $existing = ShopifyIntegration::withoutGlobalScopes()->where('user_id', $accountId)->first();
        [$clientId, $clientSecret] = $this->resolveAppCredentials($existing);
        $this->assertValidOAuthHmac($query, $clientSecret);

        $token = $this->exchangeAuthorizationCode($shop, $clientId, $clientSecret, (string) $query['code']);
        $integration = $this->persistOAuthIntegration($accountId, $shop, $token);

        return ['integration' => $integration, 'return_url' => (string) $statePayload['return_url']];
    }

    public function verifyWebhookHmac(string $rawPayload, ?string $hmacHeader, ?string $secret): bool
    {
        if (empty($hmacHeader) || empty($secret)) {
            return false;
        }

        $computed = base64_encode(hash_hmac('sha256', $rawPayload, $secret, true));

        return hash_equals($computed, $hmacHeader);
    }

    private function defaultReturnUrl(): string
    {
        return rtrim((string) request()->header('origin', url('/')), '/') . '/shopify/settings?auth=success';
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function resolveAppCredentials(?ShopifyIntegration $existing): array
    {
        $clientId = $existing?->client_id ?: config('services.shopify.client_id');
        $clientSecret = $existing?->client_secret ?: config('services.shopify.client_secret');
        if (empty($clientId) || empty($clientSecret)) {
            throw new ShopifyConnectionException('بيانات تطبيق Shopify OAuth غير مكتملة في الخادم.', 422);
        }

        return [(string) $clientId, (string) $clientSecret];
    }

    private function assertValidOAuthHmac(array $query, string $clientSecret): void
    {
        $hmac = (string) ($query['hmac'] ?? '');
        if ($hmac === '') {
            throw new ShopifyConnectionException('توقيع HMAC مفقود من رد Shopify.', 403);
        }

        $params = collect($query)->except(['hmac', 'signature'])->sortKeys()
            ->map(fn ($v, $k) => "{$k}={$v}")->implode('&');

        if (!hash_equals(hash_hmac('sha256', $params, $clientSecret), $hmac)) {
            throw new ShopifyConnectionException('توقيع التحقق الأمني HMAC غير صالح.', 403);
        }
    }

    private function exchangeAuthorizationCode(string $shop, string $clientId, string $clientSecret, string $code): string
    {
        $response = Http::timeout(20)->post("https://{$shop}/admin/oauth/access_token", [
            'client_id' => $clientId, 'client_secret' => $clientSecret, 'code' => $code,
        ]);

        if (!$response->successful() || empty($response->json('access_token'))) {
            throw new ShopifyConnectionException('فشل استبدال رمز التفويض من Shopify للحصول على Access Token.', 422);
        }

        return (string) $response->json('access_token');
    }

    private function persistOAuthIntegration(int $accountId, string $shop, string $token): ShopifyIntegration
    {
        $integration = ShopifyIntegration::withoutGlobalScopes()->firstOrNew(['user_id' => $accountId]);
        $integration->fill([
            'shop_domain' => $shop,
            'auth_mode' => ShopifyAuthMode::OAUTH,
            'access_token' => $token,
            'is_active' => true,
            'last_error' => null,
        ]);
        if (empty($integration->webhook_secret)) {
            $integration->webhook_secret = Str::random(32);
        }
        $integration->save();
        ShopifyStockSyncGate::forget($accountId);

        return $integration;
    }
}
