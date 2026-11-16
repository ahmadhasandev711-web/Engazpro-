<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveShopifyLocationMappingsRequest;
use App\Http\Requests\SaveShopifySettingsRequest;
use App\Models\Product;
use App\Models\ShopifyIntegration;
use App\Services\Shopify\ShopifySettingsService;
use App\Services\Shopify\ShopifyStockPushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ShopifySettingsController extends Controller
{
    public function __construct(
        protected ShopifySettingsService $settingsService
    ) {}

    public function getSettings(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $integration = $this->settingsService->findForAccount($request->user()->getAccountId(), true);

        return response()->json(['success' => true, 'data' => $integration ? $this->presentSettings($integration) : null]);
    }

    public function saveSettings(SaveShopifySettingsRequest $request): JsonResponse
    {
        $integration = $this->settingsService->saveSettings($request->user()->getAccountId(), $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم حفظ إعدادات Shopify بنجاح',
            'data' => $this->presentSettings($integration),
        ]);
    }

    public function testConnection(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $result = $this->settingsService->testConnection($request->user()->getAccountId());

        return response()->json([
            'success' => $result['connected'],
            'message' => $result['connected'] ? 'تم الاتصال بمتجر Shopify ومزامنة المواقع بنجاح' : 'فشل الاتصال بمتجر Shopify، يرجى التحقق من البيانات',
            'data' => $result,
        ]);
    }

    public function syncLocations(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $integration = $this->settingsService->findActiveOrFail($request->user()->getAccountId());
        $mappings = $this->settingsService->syncLocations($integration);

        return response()->json(['success' => true, 'message' => 'تم تحديث مواقع المخزون من Shopify بنجاح', 'data' => $mappings]);
    }

    public function saveLocationMappings(SaveShopifyLocationMappingsRequest $request): JsonResponse
    {
        $mappings = $this->settingsService->saveLocationMappings(
            $request->user()->getAccountId(),
            $request->validated('mappings')
        );

        return response()->json(['success' => true, 'message' => 'تم حفظ ربط المواقع بالمخازن بنجاح', 'data' => $mappings]);
    }

    public function registerWebhooks(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $success = $this->settingsService->registerWebhooks($request->user()->getAccountId());

        return response()->json([
            'success' => $success,
            'message' => $success ? 'تم تسجيل خطافات الويب (Webhooks) على Shopify بنجاح' : 'تعذر تسجيل بعض خطافات الويب على Shopify',
        ], $success ? 200 : 422);
    }

    public function importProducts(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $outcome = $this->settingsService->importProducts($request->user(), $request->boolean('import_stock', false));
        if ($outcome['queued']) {
            return response()->json(['success' => true, 'queued' => true, 'message' => 'بدأت عملية استيراد منتجات Shopify في الخلفية بنجاح'], 202);
        }
        $res = $outcome['result'];

        return response()->json([
            'success' => true,
            'queued' => false,
            'message' => "تم استيراد {$res['imported']} منتج جديد وتحديث {$res['updated']} منتج بنجاح",
            'data' => $res,
        ]);
    }

    public function pushProductStock(Product $product, ShopifyStockPushService $pushService, Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $result = $pushService->pushProductForAccount($request->user()->getAccountId(), $product);

        return response()->json(['success' => true, 'message' => $result['message'], 'data' => $result]);
    }

    public function pushAllStocks(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $outcome = $this->settingsService->pushAllStocks($request->user());
        if ($outcome['queued']) {
            return response()->json(['success' => true, 'queued' => true, 'message' => "بدأت مزامنة رصيد {$outcome['linked_count']} منتج نحو Shopify في الخلفية"], 202);
        }

        return response()->json(['success' => true, 'queued' => false, 'message' => "تم دفع رصيد {$outcome['result']['synced_count']} منتج إلى مواقع Shopify بنجاح", 'data' => $outcome['result']]);
    }

    private function presentSettings(ShopifyIntegration $integration): array
    {
        return [
            'id' => $integration->id,
            'shop_domain' => $integration->shop_domain,
            'auth_mode' => $integration->auth_mode?->value,
            'access_token_preview' => $this->maskSecret($integration->access_token),
            'client_id' => $integration->client_id,
            'has_client_secret' => !empty($integration->client_secret),
            'default_branch_id' => $integration->default_branch_id,
            'default_branch_name' => $integration->defaultBranch?->name,
            'auto_sync_stock' => $integration->auto_sync_stock,
            'is_active' => $integration->is_active,
            'webhook_url' => url("/api/webhooks/shopify/{$integration->user_id}"),
            'webhook_secret' => $integration->webhook_secret,
            'last_synced_at' => $integration->last_synced_at?->toIso8601String(),
            'last_error' => $integration->last_error,
            'linked_products_count' => $this->settingsService->countLinkedProducts($integration->user_id),
            'location_mappings' => $integration->locationMappings,
        ];
    }

    private function maskSecret(?string $value): string
    {
        if (empty($value) || strlen($value) < 10) {
            return '';
        }

        return substr($value, 0, 6) . '...' . substr($value, -4);
    }
}
