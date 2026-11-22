<?php

namespace App\Http\Controllers\Api\Easyfy;

use App\Http\Controllers\Controller;
use App\Http\Requests\Easyfy\Storefront\CheckoutOrderRequest;
use App\Http\Requests\Easyfy\Storefront\ReuploadPaymentProofRequest;
use App\Http\Resources\Easyfy\EasyfyCartResource;
use App\Http\Resources\Easyfy\EasyfyOrderResource;
use App\Services\Easyfy\EasyfyCartService;
use App\Services\Easyfy\EasyfyMediaService;
use App\Services\Easyfy\EasyfyOrderCheckoutService;
use App\Services\Easyfy\EasyfyOrderQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EasyfyOrderController extends Controller
{
    public function __construct(
        private readonly EasyfyOrderQueryService $queryService,
        private readonly EasyfyOrderCheckoutService $checkoutService,
        private readonly EasyfyCartService $cartService,
        private readonly EasyfyMediaService $mediaService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $orders = $this->queryService->paginateForAccount($request->user(), $request->only(['status', 'search', 'per_page']));

        return response()->json([
            'success' => true,
            'data' => EasyfyOrderResource::collection($orders),
            'meta' => [
                'current_page' => $orders->currentPage(), 'last_page' => $orders->lastPage(),
                'per_page' => $orders->perPage(), 'total' => $orders->total(),
            ],
        ]);
    }

    public function store(CheckoutOrderRequest $request): JsonResponse
    {
        $order = $this->checkoutService->checkout($request->user(), $request->validated(), $request->file('payment_proof'));

        return response()->json([
            'success' => true,
            'message' => "تم تسجيل طلبك ({$order->order_number}) بنجاح.",
            'data' => new EasyfyOrderResource($order),
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $order = $this->queryService->findForAccountOrFail($request->user(), $id);

        return response()->json(['success' => true, 'data' => new EasyfyOrderResource($order)]);
    }

    public function reorder(Request $request, int $id): JsonResponse
    {
        $result = $this->cartService->reorderFromOrder($request->user(), $id);

        return response()->json([
            'success' => true,
            'data' => new EasyfyCartResource($result['cart']),
            'skipped_items' => $result['skipped_items'],
        ]);
    }

    public function reuploadProof(ReuploadPaymentProofRequest $request, int $id): JsonResponse
    {
        $order = $this->checkoutService->reuploadPaymentProof(
            $request->user(),
            $id,
            $request->validated('transfer_reference'),
            $request->file('payment_proof')
        );

        return response()->json([
            'success' => true,
            'message' => 'تم رفع إثبات التحويل المحدث وإبلاغ الإدارة للمراجعة.',
            'data' => new EasyfyOrderResource($order),
        ]);
    }

    public function paymentProof(Request $request, int $id): StreamedResponse
    {
        $order = $this->queryService->findForAccountOrFail($request->user(), $id);

        return $this->mediaService->servePrivateFile($order->payment_proof_path);
    }

    public function itemArtwork(Request $request, int $id, int $itemId): StreamedResponse
    {
        $item = $this->queryService->findOrderItemForAccountOrFail($request->user(), $id, $itemId);

        return $this->mediaService->servePrivateFile($item->artwork_path);
    }
}
