<?php

namespace App\Http\Controllers\Api;

use App\Enums\EasyOrdersAuthMode;
use App\Http\Controllers\Controller;
use App\Http\Requests\SaveEasyOrdersSettingsRequest;
use App\Models\EasyOrdersIntegration;
use App\Models\Product;
use App\Services\EasyOrders\EasyOrdersSettingsService;
use App\Services\EasyOrders\EasyOrdersStockPushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class EasyOrdersSettingsController extends Controller
{
    public function __construct(
        protected EasyOrdersSettingsService $settingsService
    ) {}

    public function getSettings(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $accountId = $request->user()->getAccountId();
        $integration = $this->settingsService->findForAccount($accountId, true);

        return response()->json([
            'success' => true,
            'data' => $integration ? $this->presentSettings($integration, $accountId) : [
                'webhooks' => $this->settingsService->webhookUrls($accountId),
            ],
        ]);
    }

    public function saveSettings(SaveEasyOrdersSettingsRequest $request): JsonResponse
    {
        $accountId = $request->user()->getAccountId();
        $integration = $this->settingsService->saveSettings($accountId, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم حفظ إعدادات EasyOrders بنجاح',
            'data' => $this->presentSettings($integration, $accountId),
        ]);
    }

    public function installLink(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');

        return response()->json([
            'success' => true,
            'data' => $this->settingsService->buildInstallUrl($request->user()->getAccountId()),
        ]);
    }

    public function testConnection(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $res = $this->settingsService->testConnection($request->user()->getAccountId());

        return response()->json([
            'success' => $res['connected'],
            'message' => $res['connected'] ? 'تم الاتصال بمتجر EasyOrders بنجاح' : ($res['error'] ?? 'فشل الاتصال بمتجر EasyOrders'),
            'data' => $res,
        ], $res['connected'] ? 200 : 422);
    }

    public function importProducts(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $outcome = $this->settingsService->importProducts($request->user(), $request->boolean('import_stock', false));
        if ($outcome['queued']) {
            return response()->json(['success' => true, 'queued' => true, 'message' => 'بدأت عملية استيراد منتجات EasyOrders في الخلفية بنجاح'], 202);
        }
        $res = $outcome['result'];

        return response()->json([
            'success' => true,
            'queued' => false,
            'message' => "تم استيراد {$res['imported']} منتج جديد وتحديث {$res['updated']} منتج بنجاح",
            'data' => $res,
        ]);
    }

    public function pushProductStock(Product $product, EasyOrdersStockPushService $pushService, Request $request): JsonResponse
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
            return response()->json(['success' => true, 'queued' => true, 'message' => "بدأت مزامنة رصيد {$outcome['linked_count']} منتج نحو EasyOrders في الخلفية"], 202);
        }

        return response()->json([
            'success' => true,
            'queued' => false,
            'message' => "تم دفع رصيد {$outcome['result']['synced_count']} منتج إلى EasyOrders بنجاح",
            'data' => $outcome['result'],
        ]);
    }

    private function presentSettings(EasyOrdersIntegration $integration, int $accountId): array
    {
        return [
            'id' => $integration->id,
            'store_id' => $integration->store_id,
            'store_name' => $integration->store_name,
            'auth_mode' => $integration->auth_mode?->value ?? EasyOrdersAuthMode::API_KEY->value,
            'has_api_key' => !empty($integration->api_key),
            'has_webhook_secret' => !empty($integration->webhook_secret),
            'webhook_secret' => $integration->webhook_secret,
            'default_branch_id' => $integration->default_branch_id,
            'default_branch' => $integration->defaultBranch,
            'auto_sync_stock' => (bool) $integration->auto_sync_stock,
            'is_active' => (bool) $integration->is_active,
            'webhook_registered_at' => $integration->webhook_registered_at?->toIso8601String(),
            'last_synced_at' => $integration->last_synced_at?->toIso8601String(),
            'last_error' => $integration->last_error,
            'webhooks' => $this->settingsService->webhookUrls($accountId),
        ];
    }
}
