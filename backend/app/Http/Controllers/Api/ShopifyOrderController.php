<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ConfirmOnlineOrderRequest;
use App\Http\Requests\DeliverOnlineOrderRequest;
use App\Http\Requests\DispatchCourierRequest;
use App\Http\Requests\DispatchMandobRequest;
use App\Http\Requests\ReturnOnlineOrderRequest;
use App\Http\Resources\ShopifyOrderResource;
use App\Jobs\PullShopifyOrdersJob;
use App\Models\ShopifyOrder;
use App\Services\Shopify\ShopifyOrderQueryService;
use App\Services\Shopify\ShopifyOrderSyncService;
use App\Services\Shopify\ShopifySettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ShopifyOrderController extends Controller
{
    public function __construct(
        protected ShopifyOrderSyncService $orderSyncService,
        protected ShopifyOrderQueryService $orderQueryService,
        protected ShopifySettingsService $settingsService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $orders = $this->orderQueryService->paginateForUser(
            $request->user(),
            $request->all(),
            (int) $request->input('per_page', 20)
        )->through(fn (ShopifyOrder $order) => (new ShopifyOrderResource($order))->resolve($request));

        return response()->json(['success' => true, 'data' => $orders]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForShowOrFail($request->user(), $id);

        return response()->json(['success' => true, 'data' => new ShopifyOrderResource($order)]);
    }

    public function pull(Request $request): JsonResponse
    {
        Gate::authorize('pull-online-orders');
        $integration = $this->settingsService->findActiveOrFail($request->user()->getAccountId());
        if (config('queue.default') === 'sync') {
            $count = $this->orderSyncService->pullRecentOrders($request->user(), $integration);

            return response()->json(['success' => true, 'queued' => false, 'message' => "تم سحب ومزامنة {$count} طلب من Shopify بنجاح", 'count' => $count]);
        }

        PullShopifyOrdersJob::dispatch($request->user()->getAccountId(), $request->user()->id);

        return response()->json(['success' => true, 'queued' => true, 'message' => 'بدأت عملية سحب طلبات Shopify في الخلفية'], 202);
    }

    public function confirm(ConfirmOnlineOrderRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        $updated = $this->orderSyncService->confirmOrder($request->user(), $order, $request->resolvedBranchId(), $request->boolean('force'));

        return response()->json(['success' => true, 'message' => 'تم تأكيد طلب Shopify وتحديد فرع التجهيز بنجاح', 'data' => $updated]);
    }

    public function dispatchToMandob(DispatchMandobRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        $updated = $this->orderSyncService->dispatchToMandob($request->user(), $order, (int) $request->validated('mandob_id'));

        return response()->json(['success' => true, 'message' => 'تم إسناد طلب Shopify للمندوب بنجاح', 'data' => $updated]);
    }

    public function dispatchCourier(DispatchCourierRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        $updated = $this->orderSyncService->dispatchToCourier($request->user(), $order, $request->validated());

        return response()->json(['success' => true, 'message' => 'تم إسناد طلب Shopify لشركة الشحن بنجاح', 'data' => $updated]);
    }

    public function deliver(DeliverOnlineOrderRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        Gate::authorize('deliver-online-order', $order);
        $invoice = $this->orderSyncService->deliverOrder($request->user(), $order, $request->validated());

        return response()->json(['success' => true, 'message' => 'تم تسليم طلب Shopify وإصدار الفاتورة بنجاح', 'data' => $invoice]);
    }

    public function returnOrder(ReturnOnlineOrderRequest $request, int $id): JsonResponse
    {
        Gate::authorize('operate-online-order');
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        $this->orderSyncService->returnOrder($request->user(), $order, $request->validated('reason'));

        return response()->json(['success' => true, 'message' => 'تم تسجيل طلب Shopify كمرتجع بنجاح']);
    }
}
