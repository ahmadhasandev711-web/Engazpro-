<?php

namespace App\Services\WooCommerce;

use App\Contracts\WooCommerceApiClientInterface;
use App\Exceptions\WooCommerceConnectionException;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\SettingService;
use Illuminate\Support\Str;

class WooCommerceAuthService
{
    public function __construct(
        protected WooCommerceApiClientInterface $apiClient,
        protected SettingService $settingService
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
        $normalizedUrl = rtrim(trim($storeUrl), '/');

        // Check if integration already exists or create draft
        $integration = WooCommerceIntegration::where('user_id', $accountId)->first();
        if (!$integration) {
            $integration = WooCommerceIntegration::create([
                'user_id' => $accountId,
                'store_url' => $normalizedUrl,
                'consumer_key' => 'pending_auth',
                'consumer_secret' => 'pending_auth',
                'is_active' => false,
            ]);
        }

        $signature = $this->generateCallbackSignature($accountId);
        $callbackUrl = url('/api/woocommerce/auth-callback') . '?account_id=' . $accountId . '&signature=' . $signature;
        $finalReturnUrl = $returnUrl ?: (rtrim(request()->header('origin', url('/')), '/') . '/woocommerce/settings?auth=success');

        $query = http_build_query([
            'app_name' => 'Engaz Pro | إنجاز برو',
            'scope' => 'read_write',
            'user_id' => $accountId,
            'return_url' => $finalReturnUrl,
            'callback_url' => $callbackUrl,
        ]);

        return "{$normalizedUrl}/wc-auth/v1/authorize?{$query}";
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

        $effectiveSignature = $signature ?? ($payload['signature'] ?? null);
        if (!$this->verifyCallbackSignature($targetAccountId, $effectiveSignature)) {
            throw new WooCommerceConnectionException('رمز التحقق الأمني للربط غير صالح أو مفقود.', 403);
        }

        $user = User::withoutGlobalScopes()->find($targetAccountId);
        if (!$user) {
            throw new WooCommerceConnectionException('حساب المستخدم المطلوب غير موجود في النظام.', 404);
        }

        // Establish tenant authentication context for the incoming webhook/callback
        \Illuminate\Support\Facades\Auth::setUser($user);

        $integration = WooCommerceIntegration::withoutGlobalScopes()->where('user_id', $targetAccountId)->first();
        if (!$integration) {
            $integration = new WooCommerceIntegration(['user_id' => $targetAccountId]);
        }

        if (empty($integration->store_url)) {
            $integration->store_url = !empty($payload['store_url'])
                ? rtrim(trim($payload['store_url']), '/')
                : 'https://woocommerce.local';
        }

        $integration->consumer_key = trim($payload['consumer_key']);
        $integration->consumer_secret = trim($payload['consumer_secret']);
        $integration->is_active = true;

        if (empty($integration->webhook_secret)) {
            $integration->webhook_secret = Str::random(32);
        }

        $integration->save();

        // Attempt automatic currency sync
        try {
            $currency = $this->apiClient->getStoreCurrency($integration);
            $user = User::find($targetAccountId);
            if ($user && !empty($currency)) {
                $this->settingService->updateStoreIdentity($user, [
                    'currency' => $currency,
                    'business_name' => $this->settingService->getStoreIdentity($user)['business_name'],
                ]);
            }
        } catch (\Throwable $e) {
            // Non-blocking: currency sync failure does not break auth
        }

        // Attempt automatic webhook registration on WooCommerce
        try {
            $this->apiClient->registerWebhooks($integration);
        } catch (\Throwable $e) {
            // Non-blocking: webhook registration failure does not break auth
            \Illuminate\Support\Facades\Log::warning("Auto webhook registration skipped/failed for store #{$targetAccountId}: " . $e->getMessage());
        }

        return $integration;
    }
}
