<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WooCommerce\WooCommerceWebhookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WooCommerceWebhookController extends Controller
{
    public function __construct(
        protected WooCommerceWebhookService $webhookService
    ) {}

    public function handle(Request $request, int $userId): JsonResponse
    {
        $result = $this->webhookService->handleIncomingWebhook(
            $userId,
            $request->getContent(),
            $request->header('X-WC-Webhook-Signature'),
            $request->header('X-WC-Webhook-Topic'),
            $request->header('X-WC-Webhook-Delivery-ID')
        );

        return response()->json($result['body'], $result['status']);
    }
}
