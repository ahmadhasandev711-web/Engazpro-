<?php

namespace App\Http\Controllers\Api;

use App\Enums\EcommercePlatform;
use App\Http\Controllers\Controller;
use App\Http\Requests\CancelOnlineOrderRequest;
use App\Http\Requests\ConfirmOnlineOrderRequest;
use App\Http\Requests\DeliverOnlineOrderRequest;
use App\Http\Requests\DispatchCourierRequest;
use App\Http\Requests\DispatchMandobRequest;
use App\Http\Requests\LogOnlineOrderCallRequest;
use App\Http\Requests\ReturnOnlineOrderRequest;
use App\Http\Requests\TransferOnlineOrderBranchRequest;
use App\Http\Resources\OnlineOrderResource;
use App\Jobs\PullShopifyOrdersJob;
use App\Jobs\PullWooCommerceOrdersJob;
use App\Models\OnlineOrder;
use App\Services\BranchAvailabilityService;
use App\Services\EcommerceAccessService;
use App\Services\OnlineOrders\OnlineOrderQueryService;
use App\Services\OnlineOrders\OnlineOrderSyncService;
use App\Services\OnlineOrders\StoreOrderAdapterRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class OnlineOrderController extends Controller
{
    public function __construct(
        private readonly OnlineOrderSyncService $orderSyncService,
        private readonly OnlineOrderQueryService $orderQueryService,
        private readonly EcommerceAccessService $accessService,
        private readonly StoreOrderAdapterRegistry $adapters,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->all();
        if (empty($filters['platform']) && $active = $this->accessService->activePlatformForAccount($request->user()->getAccountId())) {
            $filters['platform'] = $active->value;
        }

        $orders = $this->orderQueryService->paginateForUser(
            $request->user(),
            $filters,
            (int) $request->input('per_page', 20)
        )->through(fn (OnlineOrder $order) => (new OnlineOrderResource($order))->resolve($request));

        $counts = $this->orderQueryService->tabCountsForUser($request->user(), $filters);

        return response()->json(['success' => true, 'data' => $orders, 'counts' => $counts]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForShowOrFail($request->user(), $id);

        return response()->json(['success' => true, 'data' => new OnlineOrderResource($order)]);
    }

    public function pull(Request $request): JsonResponse
    {
        Gate::authorize('pull-online-orders');
        $accountId = $request->user()->getAccountId();
        $platform = $this->adapters->resolveActiveForAccount($accountId)->platform();

        $this->dispatchPullJob($platform, $accountId, $request->user()->id);

        return response()->json([
            'success' => true,
            'queued' => true,
            'message' => "بدأت عملية سحب طلبات {$platform->label()} في الخلفية",
        ], 202);
    }

    public function confirm(ConfirmOnlineOrderRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        Gate::authorize('operate-online-order', $order);
        $updated = $this->orderSyncService->confirmOrder($request->user(), $order, $request->resolvedBranchId(), $request->boolean('force'));

        return response()->json(['success' => true, 'message' => 'تم تأكيد الطلب وتحديد فرع التجهيز بنجاح', 'data' => new OnlineOrderResource($updated)]);
    }

    public function dispatchToMandob(DispatchMandobRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        Gate::authorize('operate-online-order', $order);
        $updated = $this->orderSyncService->dispatchToMandob($request->user(), $order, (int) $request->validated('mandob_id'));

        return response()->json(['success' => true, 'message' => 'تم إسناد الطلب للمندوب بنجاح ونقل البضاعة لسيارة التوصيل', 'data' => new OnlineOrderResource($updated)]);
    }

    public function dispatchCourier(DispatchCourierRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        Gate::authorize('operate-online-order', $order);
        $updated = $this->orderSyncService->dispatchToCourier($request->user(), $order, $request->validated());

        return response()->json(['success' => true, 'message' => 'تم إسناد الطلب لشركة الشحن بنجاح وتحديث بيانات التتبع', 'data' => new OnlineOrderResource($updated)]);
    }

    public function deliver(DeliverOnlineOrderRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        Gate::authorize('deliver-online-order', $order);
        $invoice = $this->orderSyncService->deliverOrder($request->user(), $order, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تسليم الطلب وتحصيل المبلغ وإصدار الفاتورة رقم ' . $invoice->invoice_number,
            'data' => ['order' => new OnlineOrderResource($order->fresh(['invoice'])), 'invoice' => $invoice],
        ]);
    }

    public function returnOrder(ReturnOnlineOrderRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        Gate::authorize('deliver-online-order', $order);
        $this->orderSyncService->returnOrder($request->user(), $order, $request->validated('reason'));

        return response()->json(['success' => true, 'message' => 'تم تسجيل الطلب كمرتجع بنجاح', 'data' => new OnlineOrderResource($order->fresh())]);
    }

    public function logCall(LogOnlineOrderCallRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        Gate::authorize('operate-online-order', $order);
        $updated = $this->orderSyncService->logCallAttempt(
            $request->user(),
            $order,
            $request->callStatusEnum(),
            $request->validated('call_scheduled_at'),
            $request->validated('call_notes')
        );

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل محاولة الاتصال وتحديث سجل الكول سنتر بنجاح',
            'data' => new OnlineOrderResource($updated),
        ]);
    }

    public function cancel(CancelOnlineOrderRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        Gate::authorize('operate-online-order', $order);
        $cancelled = $this->orderSyncService->cancelOrder(
            $request->user(),
            $order,
            $request->cancelReasonEnum(),
            $request->validated('notes')
        );

        return response()->json([
            'success' => true,
            'message' => 'تم إلغاء الطلب وتحديث المتجر وفك حجز المخزون بنجاح',
            'data' => new OnlineOrderResource($cancelled),
        ]);
    }

    public function branchAvailability(Request $request, int $id, BranchAvailabilityService $availabilityService): JsonResponse
    {
        $order = $this->orderQueryService->findForShowOrFail($request->user(), $id);
        Gate::authorize('transfer-online-order-branch', $order);

        return response()->json([
            'success' => true,
            'data' => $availabilityService->getOrderBranchAvailability($request->user(), $order),
        ]);
    }

    public function transferBranch(TransferOnlineOrderBranchRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        Gate::authorize('transfer-online-order-branch', $order);
        $updated = $this->orderSyncService->transferOrderBranch(
            $request->user(),
            $order,
            (int) $request->validated('target_branch_id'),
            $request->validated('reason')
        );

        return response()->json([
            'success' => true,
            'message' => 'تم تحويل الطلب إلى الفرع المختار بنجاح وإرجاعه لحالة انتظار التأكيد',
            'data' => new OnlineOrderResource($updated),
        ]);
    }

    private function dispatchPullJob(EcommercePlatform $platform, int $accountId, int $userId): void
    {
        match ($platform) {
            EcommercePlatform::WOOCOMMERCE => PullWooCommerceOrdersJob::dispatch($accountId, $userId),
            EcommercePlatform::SHOPIFY => PullShopifyOrdersJob::dispatch($accountId, $userId),
        };
    }
}
