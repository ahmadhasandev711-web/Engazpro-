<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\GenerateAuthUrlRequest;
use App\Http\Requests\WooCommerceAuthCallbackRequest;
use App\Services\WooCommerce\WooCommerceAuthService;
use Illuminate\Http\JsonResponse;

class WooCommerceAuthController extends Controller
{
    public function __construct(
        protected WooCommerceAuthService $authService
    ) {}

    /**
     * Generate WooCommerce 1-Click OAuth authorize URL
     */
    public function authorizeUrl(GenerateAuthUrlRequest $request): JsonResponse
    {
        if (!$request->user()->isOwnerOrAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'عذراً، ربط متجر ووكومرس مخصص لمالك المنشأة ومدير النظام فقط.',
            ], 403);
        }

        $url = $this->authService->buildAuthorizeUrl(
            $request->user(),
            $request->validated('store_url'),
            $request->validated('return_url')
        );

        return response()->json([
            'success' => true,
            'data' => [
                'authorize_url' => $url,
            ],
        ]);
    }

    /**
     * Handle public callback from WooCommerce with keys
     */
    public function authCallback(WooCommerceAuthCallbackRequest $request): JsonResponse
    {
        $accountId = $request->query('account_id') ? (int) $request->query('account_id') : null;
        $signature = $request->query('signature') ?? $request->input('signature');

        try {
            $integration = $this->authService->handleCallback($request->validated(), $accountId, $signature);
        } catch (\App\Exceptions\WooCommerceConnectionException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], $e->getCode() >= 400 ? $e->getCode() : 403);
        }

        return response()->json([
            'success' => true,
            'message' => 'تم استلام وتفعيل مفاتيح الربط بنجاح.',
            'data' => [
                'id' => $integration->id,
                'is_active' => $integration->is_active,
            ],
        ]);
    }
}
