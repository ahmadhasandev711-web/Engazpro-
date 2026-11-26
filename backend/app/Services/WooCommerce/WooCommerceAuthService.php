<?php

namespace App\Services\WooCommerce;

use App\Contracts\WooCommerceApiClientInterface;
use App\Enums\EcommercePlatform;
use App\Exceptions\WooCommerceConnectionException;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\EcommerceAccessService;
use App\Services\SettingService;
use Illuminate\Support\Str;

class WooCommerceAuthService
{
    public function __construct(
        protected WooCommerceApiClientInterface $apiClient,
        protected SettingService $settingService,
        protected EcommerceAccessService $ecommerceAccess
    ) {}

    /**
     * Build the 1-Click OAuth authorize URL for WooCommerce
     */
    /**
     * Generate an HMAC-signed signature for WooCommerce OAuth callback
     */
    public function generateCallbackSignature(int $accountId): string
    {
        return hash_hmac('sha256', "wc_oauth_callback_{$accountId}", (string) config('app.key'));
    }

    /**
     * Verify the HMAC-signed signature for WooCommerce OAuth callback
     */
    public function verifyCallbackSignature(int $accountId, ?string $signature): bool
    {
        if (empty($signature)) {
            return false;
        }

        return hash_equals($this->generateCallbackSignature($accountId), $signature);
    }

    public function buildAuthorizeUrl(User $user, string $storeUrl, ?string $returnUrl = null): string
    {
        $accountId = $user->getAccountId();
        $this->ecommerceAccess->assertPlatformAllowed($accountId, EcommercePlatform::WOOCOMMERCE);
        $normalizedUrl = rtrim(trim($storeUrl), '/');
        $this->ensureDraftIntegration($accountId, $normalizedUrl);

        $signature = $this->generateCallbackSignature($accountId);
        $callbackUrl = url('/api/woocommerce/auth-callback') . '?account_id=' . $accountId . '&signature=' . $signature;
        $finalReturnUrl = $returnUrl ?: (rtrim(request()->header('origin', url('/')), '/') . '/woocommerce/settings?auth=success');

        $query = http_build_query([
            'app_name' => 'Easyfy | نظام إدارة الأعمال', 'scope' => 'read_write',
            'user_id' => $accountId, 'return_url' => $finalReturnUrl, 'callback_url' => $callbackUrl,
        ]);

        return "{$normalizedUrl}/wc-auth/v1/authorize?{$query}";
    }

    private function ensureDraftIntegration(int $accountId, string $normalizedUrl): void
    {
        if (!WooCommerceIntegration::where('user_id', $accountId)->exists()) {
            WooCommerceIntegration::create([
                'user_id' => $accountId, 'store_url' => $normalizedUrl,
                'consumer_key' => 'pending_auth', 'consumer_secret' => 'pending_auth', 'is_active' => false,
            ]);
        }
    }

    /**
     * Handle public callback from WooCommerce with generated keys
     */
    public function handleCallback(array $payload, ?int $accountId = null, ?string $signature = null): WooCommerceIntegration
    {
        $targetAccountId = $accountId ?: (int) ($payload['account_id'] ?? $payload['user_id'] ?? 0);
        if (!$targetAccountId) {
            throw new WooCommerceConnectionException('معرف المتجر غير صالح في بيانات الربط.', 400);
        }
        if (!$this->verifyCallbackSignature($targetAccountId, $signature ?? ($payload['signature'] ?? null))) {
            throw new WooCommerceConnectionException('رمز التحقق الأمني للربط غير صالح أو مفقود.', 403);
        }
        $user = User::withoutGlobalScopes()->find($targetAccountId);
        if (!$user) {
            throw new WooCommerceConnectionException('حساب المستخدم المطلوب غير موجود في النظام.', 404);
        }

        $this->ecommerceAccess->assertPlatformAllowed($targetAccountId, EcommercePlatform::WOOCOMMERCE);

        return \App\Support\TenantContext::runAs($user->id, function () use ($targetAccountId, $payload, $user) {
            $integration = $this->upsertActiveIntegration($targetAccountId, $payload);
            \App\Services\WooCommerce\WooStockSyncGate::forget($targetAccountId);
            $this->syncPostCallbackSetup($integration, $user, $targetAccountId);

            return $integration;
        });
    }

    private function upsertActiveIntegration(int $accountId, array $payload): WooCommerceIntegration
    {
        $integration = WooCommerceIntegration::withoutGlobalScopes()->firstOrNew(['user_id' => $accountId]);
        if (empty($integration->store_url)) {
            $integration->store_url = !empty($payload['store_url']) ? rtrim(trim($payload['store_url']), '/') : 'https://woocommerce.local';
        }
        $integration->consumer_key = trim($payload['consumer_key']);
        $integration->consumer_secret = trim($payload['consumer_secret']);
        $integration->is_active = true;
        $integration->webhook_secret = $integration->webhook_secret ?: Str::random(32);
        $integration->save();

        return $integration;
    }

    private function syncPostCallbackSetup(WooCommerceIntegration $integration, User $user, int $accountId): void
    {
        try {
            $currency = $this->apiClient->getStoreCurrency($integration);
            if (!empty($currency)) {
                $this->settingService->updateStoreIdentity($user, ['currency' => $currency, 'business_name' => $this->settingService->getStoreIdentity($user)['business_name']]);
            }
        } catch (\Throwable) {}

        try {
            $this->apiClient->registerWebhooks($integration);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Auto webhook registration skipped/failed for store #{$accountId}: " . $e->getMessage());
        }
    }
}
