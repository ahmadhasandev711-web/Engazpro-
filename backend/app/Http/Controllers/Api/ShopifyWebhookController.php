<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Shopify\ShopifyWebhookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShopifyWebhookController extends Controller
{
    public function __construct(
        protected ShopifyWebhookService $webhookService
    ) {}

    public function handle(Request $request, int $userId): JsonResponse
    {
        $result = $this->webhookService->handleIncomingWebhook(
            $userId,
            $request->getContent(),
            $request->header('X-Shopify-Hmac-Sha256'),
            $request->header('X-Shopify-Topic')
        );

        return response()->json($result['body'], $result['status']);
    }
}
