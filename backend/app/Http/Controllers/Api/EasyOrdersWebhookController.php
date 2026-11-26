<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\EasyOrders\EasyOrdersWebhookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EasyOrdersWebhookController extends Controller
{
    public function __construct(
        protected EasyOrdersWebhookService $webhookService
    ) {}

    public function handleOrder(Request $request, int $userId): JsonResponse
    {
        $res = $this->webhookService->handleOrderWebhook($userId, $request->all(), $request->header('secret'));

        return response()->json($res['body'], $res['status']);
    }

    public function handleOrderStatus(Request $request, int $userId): JsonResponse
    {
        $res = $this->webhookService->handleOrderStatusWebhook($userId, $request->all(), $request->header('secret'));

        return response()->json($res['body'], $res['status']);
    }

    public function handleInstallCallback(Request $request, string $token): JsonResponse
    {
        $res = $this->webhookService->handleInstallCallback($token, $request->all());

        return response()->json($res);
    }
}
