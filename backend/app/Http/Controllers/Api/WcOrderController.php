<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DispatchCourierRequest;
use App\Http\Resources\WcOrderResource;
use App\Jobs\PullWooCommerceOrdersJob;
use App\Models\User;
use App\Models\WcOrder;
use App\Services\WooCommerce\WcOrderQueryService;
use App\Services\WooCommerce\WooCommerceOrderSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        return response()->json([
            'success' => true,
            'data' => $orders,
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForShowOrFail($request->user(), $id);

        return response()->json([
            'success' => true,
            'data' => new WcOrderResource($order),
        ]);
    }

    public function confirm(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->isMandob()) {
            return $this->forbidden('عذراً، تأكيد وتجهيز الطلبات متاح للمشرف والكاشير والإدارة فقط.');
        }

        $order = $this->orderQueryService->findForAccountOrFail($user, $id);
        $validated = $request->validate([
            'branch_id' => ['required', 'exists:branches,id'],
            'force' => ['nullable', 'boolean'],
        ]);

        $branchId = (int) $validated['branch_id'];
        if ($user->isManager()) {
            if ($user->branch_id && $branchId !== (int) $user->branch_id) {
                return $this->forbidden('عذراً، كمدير فرع يمكنك تأكيد وتجهيز الطلبات من مخزن فرعك فقط.');
            }
            $branchId = (int) $user->branch_id;
        }

        $updated = $this->orderSyncService->confirmOrder($user, $order, $branchId, (bool) ($validated['force'] ?? false));

        return response()->json([
            'success' => true,
            'message' => 'تم تأكيد الطلب وتحديد فرع التجهيز بنجاح',
            'data' => $updated,
        ]);
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
                return $this->forbidden('عذراً، يمكنك إسناد الطلبات لمناديب فرعك المعينين فقط.');
            }
        }

        $updated = $this->orderSyncService->dispatchToMandob($user, $order, (int) $validated['mandob_id']);

        return response()->json([
            'success' => true,
            'message' => 'تم إسناد الطلب للمندوب بنجاح ونقل البضاعة لسيارة التوصيل',
            'data' => $updated,
        ]);
    }

    public function dispatchCourier(DispatchCourierRequest $request, int $id): JsonResponse
    {
        $order = $this->orderQueryService->findForAccountOrFail($request->user(), $id);
        $updated = $this->orderSyncService->dispatchToCourier($request->user(), $order, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم إسناد الطلب لشركة الشحن بنجاح وتحديث بيانات التتبع',
            'data' => $updated,
        ]);
    }

    public function deliver(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $order = $this->orderQueryService->findForAccountOrFail($user, $id);
        if ($this->isUnassignedMandob($user, $order)) {
            return $this->forbidden('عذراً، هذا الطلب غير مسند إليك للتوصيل.');
        }

        $validated = $request->validate([
            'collected_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'in:CASH,CARD,INSTAPAY,VODAFONE_CASH,TRANSFER,CREDIT,COURIER_COD'],
        ]);

        $invoice = $this->orderSyncService->deliverOrder($user, $order, $validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تسليم الطلب وتحصيل المبلغ وإصدار الفاتورة رقم ' . $invoice->invoice_number,
            'data' => [
                'order' => $order->fresh(['invoice']),
                'invoice' => $invoice,
            ],
        ]);
    }

    public function returnOrder(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $order = $this->orderQueryService->findForAccountOrFail($user, $id);
        if ($this->isUnassignedMandob($user, $order)) {
            return $this->forbidden('عذراً، هذا الطلب غير مسند إليك.');
        }

        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $this->orderSyncService->returnOrder($user, $order, $validated['reason'] ?? null);

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل الطلب كمرتجع بنجاح',
            'data' => $order->fresh(),
        ]);
    }

    public function pull(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwnerOrAdmin() && !$user->isManager()) {
            return $this->forbidden('عذراً، صلاحية سحب وتحديث الطلبات مقتصرة على صاحب المتجر والمدير فقط.');
        }

        PullWooCommerceOrdersJob::dispatch($user->getAccountId(), $user->id);

        return response()->json([
            'success' => true,
            'message' => 'جاري سحب الطلبات في الخلفية.',
        ], 202);
    }

    private function isUnassignedMandob(User $user, WcOrder $order): bool
    {
        return $user->isMandob() && $order->mandob_id !== $user->id;
    }

    private function forbidden(string $message): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
        ], 403);
    }
}
