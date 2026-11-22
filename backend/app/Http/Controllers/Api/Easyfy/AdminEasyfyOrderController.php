<?php

namespace App\Http\Controllers\Api\Easyfy;

use App\Enums\Easyfy\EasyfyOrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Easyfy\Admin\RejectEasyfyPaymentRequest;
use App\Http\Requests\Easyfy\Admin\UpdateEasyfyOrderCostsRequest;
use App\Http\Requests\Easyfy\Admin\UpdateEasyfyOrderStatusRequest;
use App\Http\Resources\Easyfy\EasyfyOrderResource;
use App\Services\Easyfy\EasyfyMediaService;
use App\Services\Easyfy\EasyfyOrderFulfillmentService;
use App\Services\Easyfy\EasyfyOrderQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminEasyfyOrderController extends Controller
{
    public function __construct(
        private readonly EasyfyOrderQueryService $queryService,
        private readonly EasyfyOrderFulfillmentService $fulfillmentService,
        private readonly EasyfyMediaService $mediaService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $orders = $this->queryService->paginateForAdmin($request->only([
            'status', 'payment_verification_status', 'payment_method', 'date_from', 'date_to', 'search', 'per_page',
        ]));

        return response()->json([
            'success' => true,
            'data' => EasyfyOrderResource::collection($orders),
            'meta' => [
                'current_page' => $orders->currentPage(), 'last_page' => $orders->lastPage(),
                'per_page' => $orders->perPage(), 'total' => $orders->total(),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $order = $this->queryService->findForAdminOrFail($id);

        return response()->json(['success' => true, 'data' => new EasyfyOrderResource($order)]);
    }

    public function updateStatus(UpdateEasyfyOrderStatusRequest $request, int $id): JsonResponse
    {
        $validated = $request->validated();
        $target = EasyfyOrderStatus::from((string) $validated['status']);
        $order = $this->fulfillmentService->transitionStatus($request->user(), $id, $target, $validated);

        return response()->json([
            'success' => true,
            'message' => "تم تحديث حالة الطلب ({$order->order_number}) بنجاح.",
            'data' => new EasyfyOrderResource($order),
        ]);
    }

    public function verifyPayment(Request $request, int $id): JsonResponse
    {
        $order = $this->fulfillmentService->verifyPayment($request->user(), $id, $request->input('note'));

        return response()->json([
            'success' => true,
            'message' => "تم تأكيد استلام التحويل للطلب ({$order->order_number}).",
            'data' => new EasyfyOrderResource($order),
        ]);
    }

    public function rejectPayment(RejectEasyfyPaymentRequest $request, int $id): JsonResponse
    {
        $order = $this->fulfillmentService->rejectPayment($request->user(), $id, $request->validated('reason'));

        return response()->json([
            'success' => true,
            'message' => "تم رفض إثبات التحويل للطلب ({$order->order_number}).",
            'data' => new EasyfyOrderResource($order),
        ]);
    }

    public function updateCosts(UpdateEasyfyOrderCostsRequest $request, int $id): JsonResponse
    {
        $order = $this->fulfillmentService->updateItemCosts($request->user(), $id, $request->validated('items'));

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث تكلفة البضاعة وحساب صافي الربح بنجاح.',
            'data' => new EasyfyOrderResource($order),
        ]);
    }

    public function paymentProof(int $id): StreamedResponse
    {
        $order = $this->queryService->findForAdminOrFail($id);

        return $this->mediaService->servePrivateFile($order->payment_proof_path);
    }

    public function itemArtwork(int $id, int $itemId): StreamedResponse
    {
        $item = $this->queryService->findOrderItemForAdminOrFail($id, $itemId);

        return $this->mediaService->servePrivateFile($item->artwork_path);
    }
}
