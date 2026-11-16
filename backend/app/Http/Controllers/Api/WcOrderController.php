<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ConfirmOnlineOrderRequest;
use App\Http\Requests\DeliverOnlineOrderRequest;
use App\Http\Requests\DispatchCourierRequest;
use App\Http\Requests\DispatchMandobRequest;
use App\Http\Requests\ReturnOnlineOrderRequest;
use App\Http\Resources\WcOrderResource;
use App\Jobs\PullWooCommerceOrdersJob;
use App\Models\WcOrder;
use App\Services\WooCommerce\WcOrderQueryService;
use App\Services\WooCommerce\WooCommerceOrderSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class WcOrderController extends Controller
{
    public function __construct(
        protected WooCommerceOrderSyncService $orderSyncService,
        protected WcOrderQueryService $orderQueryService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $orders = $this->orderQueryService->paginateForUser(
            $request->user(),
            $request->all(),
            (int) $request->input('per_page', 20)
        )->through(fn (WcOrder $order) => (new WcOrderResource($order))->resolve($request));

        return response()->json(['success' => true, 'data' => $orders]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForShowOrFail($request->user(), $id);

        return response()->json(['success' => true, 'data' => new WcOrderResource($order)]);
    }

    public function confirm(ConfirmOnlineOrderRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        $updated = $this->orderSyncService->confirmOrder($request->user(), $order, $request->resolvedBranchId(), $request->boolean('force'));

        return response()->json(['success' => true, 'message' => 'تم تأكيد الطلب وتحديد فرع التجهيز بنجاح', 'data' => $updated]);
    }

    public function dispatchToMandob(DispatchMandobRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        $updated = $this->orderSyncService->dispatchToMandob($request->user(), $order, (int) $request->validated('mandob_id'));

        return response()->json(['success' => true, 'message' => 'تم إسناد الطلب للمندوب بنجاح ونقل البضاعة لسيارة التوصيل', 'data' => $updated]);
    }

    public function dispatchCourier(DispatchCourierRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        $updated = $this->orderSyncService->dispatchToCourier($request->user(), $order, $request->validated());

        return response()->json(['success' => true, 'message' => 'تم إسناد الطلب لشركة الشحن بنجاح وتحديث بيانات التتبع', 'data' => $updated]);
    }

    public function deliver(DeliverOnlineOrderRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        Gate::authorize('deliver-online-order', $order);
        $invoice = $this->orderSyncService->deliverOrder($request->user(), $order, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تسليم الطلب وتحصيل المبلغ وإصدار الفاتورة رقم ' . $invoice->invoice_number,
            'data' => ['order' => $order->fresh(['invoice']), 'invoice' => $invoice],
        ]);
    }

    public function returnOrder(ReturnOnlineOrderRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        Gate::authorize('deliver-online-order', $order);
        $this->orderSyncService->returnOrder($request->user(), $order, $request->validated('reason'));

        return response()->json(['success' => true, 'message' => 'تم تسجيل الطلب كمرتجع بنجاح', 'data' => $order->fresh()]);
    }

    public function pull(Request $request): JsonResponse
    {
        Gate::authorize('pull-online-orders');
        PullWooCommerceOrdersJob::dispatch($request->user()->getAccountId(), $request->user()->id);

        return response()->json(['success' => true, 'message' => 'جاري سحب الطلبات في الخلفية.'], 202);
    }
}
