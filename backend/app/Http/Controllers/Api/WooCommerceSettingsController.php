<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveWooCommerceSettingsRequest;
use App\Models\Product;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WooCommerceSettingsService;
use App\Services\WooCommerce\WooStockPushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class WooCommerceSettingsController extends Controller
{
    public function __construct(
        protected WooCommerceSettingsService $settingsService
    ) {}

    private function presentSettings(WooCommerceIntegration $integration): array
    {
        return [
            'id' => $integration->id,
            'store_url' => $integration->store_url,
            'consumer_key_preview' => $integration->consumer_key
                ? (substr($integration->consumer_key, 0, 7) . '...' . substr($integration->consumer_key, -4))
                : '',
            'online_branch_id' => $integration->online_branch_id,
            'online_branch_name' => $integration->onlineBranch?->name,
            'auto_sync_stock' => $integration->auto_sync_stock,
            'auto_sync_prices' => (bool) ($integration->auto_sync_prices ?? false),
            'auto_sync_promotions' => (bool) ($integration->auto_sync_promotions ?? false),
            'is_active' => $integration->is_active,
            'webhook_url' => url("/api/webhooks/woocommerce/{$integration->user_id}"),
            'webhook_secret' => $integration->webhook_secret,
            'anoofy_connected' => !empty($integration->anoofy_connected_at),
            'anoofy_connected_at' => $integration->anoofy_connected_at?->toIso8601String(),
            'last_synced_at' => $integration->last_synced_at?->toIso8601String(),
            'last_error' => $integration->last_error,
        ];
    }

    public function getSettings(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $integration = $this->settingsService->findForAccount($request->user()->getAccountId(), true);

        return response()->json([
            'success' => true,
            'data' => $integration ? $this->presentSettings($integration) : null,
        ]);
    }

    public function saveSettings(SaveWooCommerceSettingsRequest $request): JsonResponse
    {
        $integration = $this->settingsService->saveSettings(
            $request->user()->getAccountId(),
            $request->validated()
        );

        return response()->json([
            'success' => true,
            'message' => 'تم حفظ إعدادات ووكومرس وتفعيل استقبال الطلبات اللحظية بنجاح',
            'data' => $this->presentSettings($integration),
        ]);
    }

    public function testConnection(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $integration = $this->settingsService->findForAccount($request->user()->getAccountId());
        if (!$integration || !$integration->consumer_key || !$integration->consumer_secret) {
            return response()->json(['success' => false, 'message' => 'يرجى إدخال مفاتيح الربط أولاً وحفظ الإعدادات'], 422);
        }

        $connected = $this->settingsService->testConnection($integration);

        return response()->json([
            'success' => $connected,
            'message' => $connected
                ? 'تم الاتصال بالمتجر وتفعيل خطافات الويب بنجاح 🟢'
                : 'فشل الاتصال بالمتجر، يرجى التحقق من الرابط والمفاتيح 🔴',
        ]);
    }

    public function autoRegisterWebhooks(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $integration = $this->settingsService->findForAccount($request->user()->getAccountId());
        if (!$integration || !$integration->consumer_key || !$integration->consumer_secret) {
            return response()->json(['success' => false, 'message' => 'يرجى ربط المتجر أولاً قبل تفعيل خطاف الويب'], 422);
        }

        $success = $this->settingsService->registerWebhooks($integration);

        return response()->json([
            'success' => $success,
            'message' => $success
                ? 'تم تسجيل وتفعيل خطافات الويب (Webhooks) تلقائياً على متجرك بنجاح 🟢'
                : 'تعذر تسجيل الـ Webhooks تلقائياً، يرجى التأكد من صلاحيات المفاتيح (Read/Write) 🔴',
        ]);
    }

    public function importProducts(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $integration = $this->settingsService->findForAccount($request->user()->getAccountId());
        if (!$integration || !$integration->is_active) {
            return response()->json(['success' => false, 'message' => 'ربط ووكومرس غير نشط أو غير مهيأ بعد'], 422);
        }

        return $this->importProductsResponse(
            $this->settingsService->importProducts($request->user(), $integration, $request->boolean('import_stock', false))
        );
    }

    public function syncCustomers(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $integration = $this->settingsService->findForAccount($request->user()->getAccountId());
        if (!$integration || !$integration->is_active) {
            return response()->json(['success' => false, 'message' => 'ربط ووكومرس غير مفعل'], 422);
        }

        $synced = $this->settingsService->syncCustomers($request->user(), $integration);

        return response()->json(['success' => true, 'message' => "تم استيراد ومزامنة {$synced} عميل من متجر ووكومرس بنجاح."]);
    }

    public function pushProductStock(Request $request, Product $product, WooStockPushService $stockPushService): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $result = $stockPushService->pushProductForAccount($request->user()->getAccountId(), $product);

        return response()->json([
            'success' => true,
            'message' => $result['message'],
            'data' => [
                'product_id' => $product->id,
                'wc_product_id' => $product->wc_product_id,
                'stock' => $result['total_stock']->toFloat(),
            ],
        ]);
    }

    public function pushAllStocks(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $accountId = $request->user()->getAccountId();
        $integration = $this->settingsService->findForAccount($accountId);
        if (!$integration || !$integration->is_active || !$integration->consumer_key || !$integration->consumer_secret) {
            return response()->json(['success' => false, 'message' => 'ربط متجر ووكومرس غير نشط أو غير مهيأ بعد بالمفاتيح.'], 422);
        }

        $linkedCount = $this->settingsService->countLinkedProducts($accountId);
        if ($linkedCount === 0) {
            return response()->json(['success' => false, 'message' => 'لا توجد أصناف مرتبطة بمتجر ووكومرس حالياً لمزامنة أرصدتها.'], 422);
        }

        return $this->pushAllStocksResponse($this->settingsService->pushAllStocks($request->user(), $linkedCount));
    }

    public function pushAllPrices(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $accountId = $request->user()->getAccountId();
        $integration = $this->settingsService->findForAccount($accountId);
        if (!$integration || !$integration->is_active || !$integration->consumer_key || !$integration->consumer_secret) {
            return response()->json(['success' => false, 'message' => 'ربط متجر ووكومرس غير نشط أو غير مهيأ بعد بالمفاتيح.'], 422);
        }

        $linkedCount = $this->settingsService->countLinkedProducts($accountId);
        if ($linkedCount === 0) {
            return response()->json(['success' => false, 'message' => 'لا توجد أصناف مرتبطة بمتجر ووكومرس حالياً لمزامنة أسعارها.'], 422);
        }

        $outcome = $this->settingsService->pushAllPrices($request->user(), $integration, $linkedCount);
        if (!$outcome['queued']) {
            $res = $outcome['result'];
            return response()->json(['success' => true, 'message' => "تمت مزامنة أسعار {$res['synced_count']} صنف مع ووكومرس بنجاح.", 'data' => $res]);
        }

        return response()->json(['success' => true, 'message' => 'بدأت مزامنة الأسعار مع ووكومرس في الخلفية.', 'data' => ['status' => 'queued', 'total_linked_products' => $outcome['total_linked_products']]], 202);
    }

    public function syncCoupons(Request $request): JsonResponse
    {
        Gate::authorize('manage-ecommerce');
        $integration = $this->settingsService->findForAccount($request->user()->getAccountId());
        if (!$integration || !$integration->is_active || !$integration->consumer_key || !$integration->consumer_secret) {
            return response()->json(['success' => false, 'message' => 'ربط ووكومرس غير مفعل أو غير مكتمل المفاتيح.'], 422);
        }

        $outcome = $this->settingsService->syncCoupons($request->user(), $integration);
        if (!$outcome['queued']) {
            $res = $outcome['result'];
            return response()->json(['success' => true, 'message' => "تم سحب {$res['imported']} كوبون جديد وتحديث {$res['updated']} كوبون من ووكومرس بنجاح.", 'data' => $res]);
        }

        return response()->json(['success' => true, 'message' => 'بدأت عملية سحب كوبونات ووكومرس في الخلفية.', 'data' => ['status' => 'queued']], 202);
    }

    private function importProductsResponse(array $outcome): JsonResponse
    {
        if (!$outcome['queued']) {
            $res = $outcome['result'];

            return response()->json([
                'success' => true,
                'message' => "اكتمل استيراد الأصناف: تم إنشاء {$res['imported']} صنف جديد، وتحديث {$res['updated']} صنف.",
                'data' => $res,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'بدأ استيراد الأصناف من ووكومرس في الخلفية. راجع آخر مزامنة في الإعدادات بعد اكتمال العملية.',
            'data' => ['status' => 'queued'],
        ], 202);
    }

    private function pushAllStocksResponse(array $outcome): JsonResponse
    {
        if (!$outcome['queued']) {
            $res = $outcome['result'];

            return response()->json([
                'success' => true,
                'message' => "تمت مزامنة وتحديث أرصدة {$res['synced_count']} صنف مع متجر ووكومرس بنجاح 🟢",
                'data' => $res,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'بدأت مزامنة الأرصدة مع ووكومرس في الخلفية. قد تستغرق العملية عدة دقائق حسب حجم الكتالوج.',
            'data' => ['status' => 'queued', 'total_linked_products' => $outcome['total_linked_products']],
        ], 202);
    }
}
