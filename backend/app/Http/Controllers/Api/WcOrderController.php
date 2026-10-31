<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\WcOrderResource;
use App\Jobs\PullWooCommerceOrdersJob;
use App\Models\WcOrder;
use App\Services\WooCommerce\WooCommerceOrderSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WcOrderController extends Controller
{
    public function __construct(
        protected WooCommerceOrderSyncService $orderSyncService
    ) {}

    /**
     * List WooCommerce orders with filters
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = WcOrder::where('user_id', $user->getAccountId())
            ->with(['party', 'branch', 'mandob', 'courierParty', 'invoice']);

        if ($user->isMandob()) {
            $query->where('mandob_id', $user->id);
        } elseif ($user->isManager()) {
            if ($user->branch_id) {
                $query->where('branch_id', $user->branch_id);
            }
        } elseif ($user->isCashier() || $user->isSales()) {
            if ($user->branch_id) {
                $query->where('branch_id', $user->branch_id);
            } else {
                $query->whereRaw('1 = 0');
            }
        } elseif ($request->filled('mandob_id')) {
            $query->where('mandob_id', $request->input('mandob_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('branch_id') && !$user->isManager()) {
            $query->where('branch_id', $request->input('branch_id'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('wc_order_id', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%")
                    ->orWhereHas('party', function ($sub) use ($search) {
                        $sub->where('phone', 'like', "%{$search}%")
                            ->orWhere('name', 'like', "%{$search}%");
                    });
            });
        }

        if ($request->filled('date_from')) {
            $dateFromStart = $request->input('date_from') . ' 00:00:00';
            $query->where(function ($q) use ($dateFromStart) {
                $q->where('order_date', '>=', $dateFromStart)
                    ->orWhere(function ($sub) use ($dateFromStart) {
                        $sub->whereNull('order_date')
                            ->where('created_at', '>=', $dateFromStart);
                    });
            });
        }

        if ($request->filled('date_to')) {
            $dateToEnd = $request->input('date_to') . ' 23:59:59';
            $query->where(function ($q) use ($dateToEnd) {
                $q->where('order_date', '<=', $dateToEnd)
                    ->orWhere(function ($sub) use ($dateToEnd) {
                        $sub->whereNull('order_date')
                            ->where('created_at', '<=', $dateToEnd);
                    });
            });
        }

        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);
        $orders = $query->orderByRaw('COALESCE(order_date, created_at) DESC')->orderByDesc('id')->paginate($perPage)
            ->through(fn (WcOrder $order) => (new WcOrderResource($order))->resolve($request));

        return response()->json([
            'success' => true,
            'data' => $orders,
        ]);
    }

    /**
     * View single order details
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $query = WcOrder::where('user_id', $user->getAccountId())
            ->with(['party', 'branch', 'mandob', 'courierParty', 'invoice']);

        if ($user->isMandob()) {
            $query->where('mandob_id', $user->id);
        } elseif ($user->isManager() && $user->branch_id) {
            $query->where('branch_id', $user->branch_id);
        } elseif ($user->isCashier() || $user->isSales()) {
            if ($user->branch_id) {
                $query->where('branch_id', $user->branch_id);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        $order = $query->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => new WcOrderResource($order),
        ]);
    }

    /**
     * Confirm order and check stock availability
     */
    public function confirm(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->isMandob()) {
            return response()->json([
                'success' => false,
                'message' => 'عذراً، تأكيد وتجهيز الطلبات متاح للمشرف والكاشير والإدارة فقط.',
            ], 403);
        }

        $order = WcOrder::where('user_id', $user->getAccountId())->findOrFail($id);

        $validated = $request->validate([
            'branch_id' => ['required', 'exists:branches,id'],
            'force' => ['nullable', 'boolean'],
        ]);

        $branchId = (int) $validated['branch_id'];
        if ($user->isManager()) {
            if ($user->branch_id && $branchId !== (int) $user->branch_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'عذراً، كمدير فرع يمكنك تأكيد وتجهيز الطلبات من مخزن فرعك فقط.',
                ], 403);
            }
            $branchId = (int) $user->branch_id;
        }

        $updated = $this->orderSyncService->confirmOrder(
            $user,
            $order,
            $branchId,
            (bool) ($validated['force'] ?? false)
        );

        return response()->json([
            'success' => true,
            'message' => 'تم تأكيد الطلب وتحديد فرع التجهيز بنجاح',
            'data' => $updated,
        ]);
    }

    /**
     * Dispatch order to mandob / van
     */
    public function dispatchToMandob(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->isMandob()) {
            return response()->json([
                'success' => false,
                'message' => 'عذراً، إسناد الطلبات للمناديب متاح للمشرف والكاشير والإدارة فقط.',
            ], 403);
        }

        $order = WcOrder::where('user_id', $user->getAccountId())->findOrFail($id);

        $validated = $request->validate([
            'mandob_id' => ['required', 'exists:users,id'],
        ]);

        if ($user->isManager() && $user->branch_id) {
            $mandob = \App\Models\User::where('owner_id', $user->getAccountId())->findOrFail($validated['mandob_id']);
            if ($mandob->branch_id !== $user->branch_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'عذراً، يمكنك إسناد الطلبات لمناديب فرعك المعينين فقط.',
                ], 403);
            }
        }

        $updated = $this->orderSyncService->dispatchToMandob($user, $order, (int) $validated['mandob_id']);

        return response()->json([
            'success' => true,
            'message' => 'تم إسناد الطلب للمندوب بنجاح ونقل البضاعة لسيارة التوصيل',
            'data' => $updated,
        ]);
    }

    /**
     * Dispatch order to external courier company (Bosta, Aramex, etc.)
     */
    public function dispatchCourier(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->isMandob()) {
            return response()->json([
                'success' => false,
                'message' => 'عذراً، إسناد الطلبات لشركات الشحن متاح للمشرف والكاشير والإدارة فقط.',
            ], 403);
        }

        $accountId = $user->getAccountId();

        $validated = $request->validate([
            'courier_party_id' => [
                'required',
                'integer',
                \Illuminate\Validation\Rule::exists('parties', 'id')->where(function ($q) use ($accountId) {
                    $q->where('user_id', $accountId)->where('type', 'COURIER');
                }),
            ],
            'courier_name' => ['nullable', 'string', 'max:255'],
            'tracking_number' => ['nullable', 'string', 'max:255'],
            'branch_id' => [
                'nullable',
                'integer',
                \Illuminate\Validation\Rule::exists('branches', 'id')->where('user_id', $accountId),
            ],
        ], [
            'courier_party_id.required' => 'يرجى اختيار شركة شحن مسجلة بالدفاتر لإسناد الشحنة وتوثيق المديونية.',
            'courier_party_id.exists' => 'شركة الشحن المحددة غير صالحة أو غير مسجلة بالدفاتر.',
        ]);

        $order = WcOrder::where('user_id', $accountId)->findOrFail($id);

        $updated = $this->orderSyncService->dispatchToCourier($user, $order, $validated);

        return response()->json([
            'success' => true,
            'message' => 'تم إسناد الطلب لشركة الشحن بنجاح وتحديث بيانات التتبع',
            'data' => $updated,
        ]);
    }

    /**
     * Deliver order, collect payment, and create official Sales Invoice
     */
    public function deliver(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $order = WcOrder::where('user_id', $user->getAccountId())->findOrFail($id);

        if ($user->isMandob() && $order->mandob_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'عذراً، هذا الطلب غير مسند إليك للتوصيل.',
            ], 403);
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

    /**
     * Mark order as returned
     */
    public function returnOrder(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $order = WcOrder::where('user_id', $user->getAccountId())->findOrFail($id);

        if ($user->isMandob() && $order->mandob_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'عذراً، هذا الطلب غير مسند إليك.',
            ], 403);
        }

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $this->orderSyncService->returnOrder($user, $order, $validated['reason'] ?? null);

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل الطلب كمرتجع بنجاح',
            'data' => $order->fresh(),
        ]);
    }

    /**
     * Pull and sync recent orders from WooCommerce REST API
     */
    public function pull(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwnerOrAdmin() && !$user->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'عذراً، صلاحية سحب وتحديث الطلبات مقتصرة على صاحب المتجر والمدير فقط.',
            ], 403);
        }

        PullWooCommerceOrdersJob::dispatch($user->getAccountId(), $user->id);

        return response()->json([
            'success' => true,
            'message' => 'جاري سحب الطلبات في الخلفية.',
        ], 202);
    }
}

