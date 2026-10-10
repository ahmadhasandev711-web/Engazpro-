<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WooCommerceApiClient;
use App\Services\WooCommerce\WooCommerceProductImportService;
use App\Services\WooCommerce\WooCommerceCustomerSyncService;
use App\Models\Party;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WooCommerceSettingsController extends Controller
{
    public function __construct(
        protected WooCommerceApiClient $apiClient,
        protected WooCommerceProductImportService $importService,
        protected WooCommerceCustomerSyncService $customerSyncService
    ) {}

    protected function checkOwnerOrAdmin(Request $request): ?JsonResponse
    {
        if (!$request->user()->isOwnerOrAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'عذراً، إعدادات وربط متجر ووكومرس مخصصة لمالك المنشأة ومدير النظام فقط.',
            ], 403);
        }
        return null;
    }

    /**
     * Get WooCommerce integration settings for the authenticated store
     */
    public function getSettings(Request $request): JsonResponse
    {
        if ($err = $this->checkOwnerOrAdmin($request)) {
            return $err;
        }

        $user = $request->user();
        $integration = WooCommerceIntegration::where('user_id', $user->getAccountId())
            ->with('onlineBranch')
            ->first();

        if (!$integration) {
            return response()->json([
                'success' => true,
                'data' => null,
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $integration->id,
                'store_url' => $integration->store_url,
                'consumer_key_preview' => $integration->consumer_key ? (substr($integration->consumer_key, 0, 7) . '...' . substr($integration->consumer_key, -4)) : '',
                'online_branch_id' => $integration->online_branch_id,
                'online_branch_name' => $integration->onlineBranch?->name,
                'auto_sync_stock' => $integration->auto_sync_stock,
                'is_active' => $integration->is_active,
                'webhook_url' => url("/api/webhooks/woocommerce/{$user->getAccountId()}"),
                'webhook_secret' => $integration->webhook_secret,
                'last_synced_at' => $integration->last_synced_at?->toIso8601String(),
                'last_error' => $integration->last_error,
            ],
        ]);
    }

    /**
     * Save or update integration settings
     */
    public function saveSettings(Request $request): JsonResponse
    {
        if ($err = $this->checkOwnerOrAdmin($request)) {
            return $err;
        }

        $user = $request->user();
        $validated = $request->validate([
            'store_url' => ['required', 'url'],
            'consumer_key' => ['nullable', 'string'],
            'consumer_secret' => ['nullable', 'string'],
            'online_branch_id' => ['nullable', 'exists:branches,id'],
            'auto_sync_stock' => ['boolean'],
            'is_active' => ['boolean'],
        ]);

        $integration = WooCommerceIntegration::firstOrNew(['user_id' => $user->getAccountId()]);
        $integration->store_url = rtrim($validated['store_url'], '/');
        
        if (!empty($validated['consumer_key'])) {
            $integration->consumer_key = trim($validated['consumer_key']);
        }
        if (!empty($validated['consumer_secret'])) {
            $integration->consumer_secret = trim($validated['consumer_secret']);
        }
        if (empty($integration->webhook_secret)) {
            $integration->webhook_secret = Str::random(32);
        }

        $integration->online_branch_id = $validated['online_branch_id'] ?? $integration->online_branch_id;
        $integration->auto_sync_stock = $validated['auto_sync_stock'] ?? $integration->auto_sync_stock ?? true;
        $integration->is_active = $validated['is_active'] ?? true;
        $integration->save();

        // Automatically register order webhooks on WooCommerce
        if ($integration->is_active && $integration->consumer_key && $integration->consumer_secret) {
            try {
                $this->apiClient->registerWebhooks($integration);
            } catch (\Throwable $e) {
                // Non-blocking
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'تم حفظ إعدادات ووكومرس وتفعيل استقبال الطلبات اللحظية بنجاح',
            'data' => $integration,
        ]);
    }

    /**
     * Test connection to WooCommerce store
     */
    public function testConnection(Request $request): JsonResponse
    {
        if ($err = $this->checkOwnerOrAdmin($request)) {
            return $err;
        }

        $user = $request->user();
        $integration = WooCommerceIntegration::where('user_id', $user->getAccountId())->first();

        if (!$integration || !$integration->consumer_key || !$integration->consumer_secret) {
            return response()->json([
                'success' => false,
                'message' => 'يرجى إدخال مفاتيح الربط أولاً وحفظ الإعدادات',
            ], 422);
        }

        $connected = $this->apiClient->testConnection($integration);
        if ($connected && $integration->is_active) {
            try {
                $this->apiClient->registerWebhooks($integration);
            } catch (\Throwable $e) {
                // Non-blocking
            }
        }

        return response()->json([
            'success' => $connected,
            'message' => $connected ? 'تم الاتصال بالمتجر وتفعيل خطافات الويب بنجاح 🟢' : 'فشل الاتصال بالمتجر، يرجى التحقق من الرابط والمفاتيح 🔴',
        ]);
    }

    /**
     * Explicitly trigger automatic webhook registration on WooCommerce
     */
    public function autoRegisterWebhooks(Request $request): JsonResponse
    {
        if ($err = $this->checkOwnerOrAdmin($request)) {
            return $err;
        }

        $user = $request->user();
        $integration = WooCommerceIntegration::where('user_id', $user->getAccountId())->first();

        if (!$integration || !$integration->consumer_key || !$integration->consumer_secret) {
            return response()->json([
                'success' => false,
                'message' => 'يرجى ربط المتجر أولاً قبل تفعيل خطاف الويب',
            ], 422);
        }

        $success = $this->apiClient->registerWebhooks($integration);

        return response()->json([
            'success' => $success,
            'message' => $success
                ? 'تم تسجيل وتفعيل خطافات الويب (Webhooks) تلقائياً على متجرك بنجاح 🟢'
                : 'تعذر تسجيل الـ Webhooks تلقائياً، يرجى التأكد من صلاحيات المفاتيح (Read/Write) 🔴',
        ]);
    }

    /**
     * Import products from WooCommerce (One-way: Woo -> Kashat)
     */
    public function importProducts(Request $request): JsonResponse
    {
        if ($err = $this->checkOwnerOrAdmin($request)) {
            return $err;
        }

        $user = $request->user();
        $integration = WooCommerceIntegration::where('user_id', $user->getAccountId())->first();

        if (!$integration || !$integration->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'ربط ووكومرس غير نشط أو غير مهيأ بعد',
            ], 422);
        }

        $importStock = $request->boolean('import_stock', false);
        $result = $this->importService->importProducts($user, $integration, $importStock);

        return response()->json([
            'success' => true,
            'message' => "اكتمل استيراد الأصناف: تم إنشاء {$result['imported']} صنف جديد، وتحديث {$result['updated']} صنف.",
            'data' => $result,
        ]);
    }

    /**
     * Bulk sync customers between Kashat and WooCommerce
     */
    public function syncCustomers(Request $request): JsonResponse
    {
        if ($err = $this->checkOwnerOrAdmin($request)) {
            return $err;
        }

        $user = $request->user();
        $integration = WooCommerceIntegration::where('user_id', $user->getAccountId())->first();

        if (!$integration || !$integration->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'ربط ووكومرس غير مفعل',
            ], 422);
        }

        // 1. Pull recent customers from WooCommerce
        $wcCustomers = $this->apiClient->getCustomers($integration, 1, 50);
        $syncedFromWoo = 0;
        foreach ($wcCustomers as $wcCust) {
            $this->customerSyncService->syncCustomerFromWooCommerce($user, $wcCust);
            $syncedFromWoo++;
        }

        return response()->json([
            'success' => true,
            'message' => "تم استيراد ومزامنة {$syncedFromWoo} عميل من متجر ووكومرس بنجاح.",
        ]);
    }
}
