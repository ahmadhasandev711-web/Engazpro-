<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WooCommerceOrderSyncService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WooCommerceWebhookController extends Controller
{
    public function __construct(
        protected WooCommerceOrderSyncService $orderSyncService
    ) {}

    /**
     * Handle incoming webhook from WooCommerce
     */
    public function handle(Request $request, int $userId): JsonResponse
    {
        $integration = WooCommerceIntegration::withoutGlobalScopes()
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->first();

        if (!$integration) {
            return response()->json(['message' => 'Integration inactive or not found'], 404);
        }

        $user = User::withoutGlobalScopes()->find($userId);
        if (!$user) {
            return response()->json(['message' => 'Store owner not found'], 404);
        }

        $rawPayload = $request->getContent();
        $signature = $request->header('X-WC-Webhook-Signature');

        // Verify HMAC-SHA256 signature strictly
        if (empty($integration->webhook_secret)) {
            Log::error("WooCommerce webhook rejected: webhook_secret not configured for user #{$userId}");
            return response()->json(['message' => 'Webhook secret not configured'], 403);
        }

        if (empty($signature)) {
            Log::warning("Missing WooCommerce webhook signature header for user #{$userId}");
            return response()->json(['message' => 'Unauthorized webhook signature'], 401);
        }

        $expectedSignature = base64_encode(hash_hmac('sha256', $rawPayload, $integration->webhook_secret, true));
        if (!hash_equals($expectedSignature, $signature)) {
            Log::warning("Invalid WooCommerce webhook signature for user #{$userId}");
            return response()->json(['message' => 'Unauthorized webhook signature'], 401);
        }

        // Establish tenant authentication context for the webhook request
        \Illuminate\Support\Facades\Auth::setUser($user);

        $topic = $request->header('X-WC-Webhook-Topic');
        if ($topic && !str_starts_with($topic, 'order.') && !str_contains($topic, 'ping')) {
            return response()->json(['message' => "Webhook topic '{$topic}' ignored"], 200);
        }

        $payload = json_decode($rawPayload, true);
        if (!$payload) {
            return response()->json(['message' => 'Invalid JSON payload'], 400);
        }

        // Handle webhook verification ping from WooCommerce
        if (isset($payload['webhook_id'])) {
            return response()->json(['message' => 'Webhook ping received successfully'], 200);
        }

        // Process order webhook (order.created or order.updated)
        try {
            if (!empty($payload['id'])) {
                $order = $this->orderSyncService->handleIncomingOrder($user, $payload);
                return response()->json([
                    'success' => true,
                    'message' => "Order #{$order->wc_order_id} processed successfully",
                    'order_id' => $order->id,
                ], 200);
            }
        } catch (Exception $e) {
            Log::error("Failed to process WooCommerce webhook order for user #{$userId}: " . $e->getMessage(), [
                'exception' => $e,
            ]);
            return response()->json(['message' => 'تعذر معالجة الطلب. يرجى مراجعة سجلات النظام.'], 500);
        }

        return response()->json(['message' => 'Webhook received'], 200);
    }
}
