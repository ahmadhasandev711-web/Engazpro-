<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\IndexExchangeRequest;
use App\Http\Requests\StoreExchangeRequest;
use App\Http\Requests\StoreOnlineExchangeRequest;
use App\Http\Requests\SwapOnlineOrderItemsRequest;
use App\Http\Resources\ExchangeResource;
use App\Http\Resources\InvoiceResource;
use App\Http\Resources\OnlineOrderResource;
use App\Http\Resources\StoreCreditTransactionResource;
use App\Services\Exchange\ExchangeCancellationService;
use App\Services\Exchange\ExchangeLookupService;
use App\Services\Exchange\ExchangeQueryService;
use App\Services\Exchange\OnlineExchangeService;
use App\Services\Exchange\PosExchangeService;
use App\Services\Exchange\StoreCreditService;
use App\Services\OnlineOrders\OnlineOrderQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ExchangeController extends Controller
{
    public function __construct(
        private readonly ExchangeQueryService $queryService,
        private readonly ExchangeLookupService $lookupService,
        private readonly PosExchangeService $posExchangeService,
        private readonly OnlineExchangeService $onlineExchangeService,
        private readonly StoreCreditService $storeCreditService,
        private readonly ExchangeCancellationService $cancellationService,
        private readonly OnlineOrderQueryService $onlineOrderQueryService,
    ) {}

    public function index(IndexExchangeRequest $request): JsonResponse
    {
        $exchanges = $this->queryService->paginateForUser($request->user(), $request->validated());

        return response()->json([
            'success' => true,
            'data' => ExchangeResource::collection($exchanges),
            'meta' => [
                'current_page' => $exchanges->currentPage(),
                'last_page' => $exchanges->lastPage(),
                'per_page' => $exchanges->perPage(),
                'total' => $exchanges->total(),
            ],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $exchange = $this->queryService->findForShowOrFail($request->user(), $id);

        return response()->json(['success' => true, 'data' => new ExchangeResource($exchange)]);
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $exchange = $this->cancellationService->cancel($request->user(), $id);

        return response()->json([
            'success' => true,
            'message' => "تم إلغاء وعكس سند الاستبدال ({$exchange->exchange_number}) وإعادة الأرصدة بنجاح.",
            'data' => new ExchangeResource($exchange),
        ]);
    }

    public function lookupInvoices(Request $request): JsonResponse
    {
        $query = (string) $request->query('q', '');
        $invoices = $this->lookupService->lookupSaleInvoices($request->user(), $query);

        return response()->json([
            'success' => true,
            'data' => InvoiceResource::collection($invoices),
        ]);
    }

    public function store(StoreExchangeRequest $request): JsonResponse
    {
        $exchange = $this->posExchangeService->execute($request->user(), $request->validated());

        return response()->json([
            'success' => true,
            'message' => "تم تنفيذ عملية الاستبدال بنجاح ({$exchange->exchange_number}).",
            'data' => new ExchangeResource($exchange),
        ], 201);
    }

    public function swapOnlineOrderItems(SwapOnlineOrderItemsRequest $request, int $id): JsonResponse
    {
        $order = $this->onlineOrderQueryService->findForAccountOrFail($request->user(), $id);
        Gate::authorize('operate-online-order', $order);
        $updated = $this->onlineExchangeService->swapBeforeDelivery($request->user(), $order, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تبديل أصناف ومقاسات الطلب قبل الشحن وتحديث حجز المخزون بنجاح.',
            'data' => new OnlineOrderResource($updated),
        ]);
    }

    public function createOnlineOrderExchange(StoreOnlineExchangeRequest $request, int $id): JsonResponse
    {
        $order = $this->onlineOrderQueryService->findForAccountOrFail($request->user(), $id);
        Gate::authorize('operate-online-order', $order);
        $exchange = $this->onlineExchangeService->createPostDeliveryExchange($request->user(), $order, $request->validated());

        return response()->json([
            'success' => true,
            'message' => "تم إنشاء شحنة الاستبدال ({$exchange->exchange_number}) وإدراجها في طلبات المتجر للشحن.",
            'data' => new ExchangeResource($exchange),
        ], 201);
    }

    public function partyStoreCredit(Request $request, int $partyId): JsonResponse
    {
        $party = $this->queryService->findScopedPartyOrFail($request->user(), $partyId);
        $balance = $this->storeCreditService->getValidBalance($request->user(), $party);
        $history = $this->storeCreditService->getHistoryForParty($request->user(), $party);

        return response()->json([
            'success' => true,
            'data' => [
                'balance' => $balance->getAmount(),
                'transactions' => StoreCreditTransactionResource::collection($history),
            ],
        ]);
    }
}
