<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentMethod;
use App\Http\Controllers\Controller;
use App\Http\Requests\DispatchCourierRequest;
use App\Http\Resources\ShopifyOrderResource;
use App\Jobs\PullShopifyOrdersJob;
use App\Models\ShopifyOrder;
use App\Services\Shopify\ShopifyOrderQueryService;
use App\Services\Shopify\ShopifyOrderSyncService;
use App\Services\Shopify\ShopifySettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
        if ($request->user()->isMandob()) {
            return $this->forbidden('عذراً، سحب الطلبات متاح للمشرف والكاشير والإدارة فقط.');
        }

        $integration = $this->settingsService->findActiveOrFail($request->user()->getAccountId());
        if (config('queue.default') === 'sync') {
            $count = $this->orderSyncService->pullRecentOrders($request->user(), $integration);

            return response()->json(['success' => true, 'queued' => false, 'message' => "تم سحب ومزامنة {$count} طلب من Shopify بنجاح", 'count' => $count]);
        }

        PullShopifyOrdersJob::dispatch($request->user()->getAccountId(), $request->user()->id);

        return response()->json(['success' => true, 'queued' => true, 'message' => 'بدأت عملية سحب طلبات Shopify في الخلفية'], 202);
    }

    public function confirm(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->isMandob()) {
            return $this->forbidden('عذراً، تأكيد وتجهيز الطلبات متاح للمشرف والكاشير والإدارة فقط.');
        }

        $validated = $request->validate(['branch_id' => ['required', 'exists:branches,id'], 'force' => ['nullable', 'boolean']]);
        $branchId = $user->isManager() && $user->branch_id ? (int) $user->branch_id : (int) $validated['branch_id'];
        if ($user->isManager() && $user->branch_id && (int) $validated['branch_id'] !== (int) $user->branch_id) {
            return $this->forbidden('عذراً، كمدير فرع يمكنك تأكيد الطلبات من مخزن فرعك فقط.');
        }

        $order = $this->orderQueryService->findForAccountOrFail($user, $id);
        $updated = $this->orderSyncService->confirmOrder($user, $order, $branchId, (bool) ($validated['force'] ?? false));

        return response()->json(['success' => true, 'message' => 'تم تأكيد طلب Shopify وتحديد فرع التجهيز بنجاح', 'data' => $updated]);
    }

    public function dispatchToMandob(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->isMandob()) {
            return $this->forbidden('عذراً، إسناد الطلبات للمناديب متاح للمشرف والكاشير والإدارة فقط.');
        }

        $order = $this->orderQueryService->findForAccountOrFail($user, $id);
        $validated = $request->validate(['mandob_id' => ['required', 'exists:users,id']]);
        if ($user->isManager() && $user->branch_id) {
            $mandob = $this->orderQueryService->findAccountUserOrFail($user->getAccountId(), (int) $validated['mandob_id']);
            if ($mandob->branch_id !== $user->branch_id) {
                return $this->forbidden('عذراً، يمكنك إسناد الطلبات لمناديب فرعك فقط.');
            }
        }

        $updated = $this->orderSyncService->dispatchToMandob($user, $order, (int) $validated['mandob_id']);

        return response()->json(['success' => true, 'message' => 'تم إسناد طلب Shopify للمندوب بنجاح', 'data' => $updated]);
    }

    public function dispatchCourier(DispatchCourierRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        $updated = $this->orderSyncService->dispatchToCourier($request->user(), $order, $request->validated());

        return response()->json(['success' => true, 'message' => 'تم إسناد طلب Shopify لشركة الشحن بنجاح', 'data' => $updated]);
    }

    public function deliver(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $order = $this->orderQueryService->findForAccountOrFail($user, $id);
        if ($user->isMandob() && (int) $order->mandob_id !== (int) $user->id) {
            return $this->forbidden('عذراً، هذا الطلب غير مسند إليك للتوصيل.');
        }

        $validated = $request->validate([
            'collected_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string', Rule::enum(PaymentMethod::class)],
        ]);
        $invoice = $this->orderSyncService->deliverOrder($user, $order, $validated);

        return response()->json(['success' => true, 'message' => 'تم تسليم طلب Shopify وإصدار الفاتورة بنجاح', 'data' => $invoice]);
    }

    public function returnOrder(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->isMandob()) {
            return $this->forbidden('عذراً، تسجيل مرتجعات المتجر متاح للمشرف والكاشير والإدارة فقط.');
        }

        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $order = $this->orderQueryService->findForAccountOrFail($user, $id);
        $this->orderSyncService->returnOrder($user, $order, $validated['reason'] ?? null);

        return response()->json(['success' => true, 'message' => 'تم تسجيل طلب Shopify كمرتجع بنجاح']);
    }
}
