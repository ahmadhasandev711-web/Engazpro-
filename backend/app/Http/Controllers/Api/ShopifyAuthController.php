<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Shopify\ShopifyAuthService;
use App\Services\Shopify\ShopifySettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ShopifyAuthController extends Controller
{
    public function __construct(
        protected ShopifyAuthService $authService,
        protected ShopifySettingsService $settingsService
    ) {}

    public function authorizeUrl(Request $request): JsonResponse
    {
        if (!$request->user()->isOwnerOrAdmin()) {
            return $this->forbidden('عذراً، إعدادات وربط متجر Shopify مخصصة لمالك المنشأة ومدير النظام فقط.');
        }

        $validated = $request->validate([
            'shop_domain' => ['required', 'string', 'max:255'],
            'return_url' => ['nullable', 'url', 'max:500'],
        ]);

        $url = $this->authService->buildAuthorizeUrl(
            $request->user(),
            $validated['shop_domain'],
            $validated['return_url'] ?? null
        );

        return response()->json(['success' => true, 'authorize_url' => $url]);
    }

    public function callback(Request $request): JsonResponse|RedirectResponse
    {
        $result = $this->authService->handleCallback($request->query());
        $this->settingsService->syncPostOAuthSetup($result['integration']);

        if ($request->expectsJson()) {
            return response()->json(['success' => true, 'data' => ['shop_domain' => $result['integration']->shop_domain]]);
        }

        return redirect()->away($result['return_url']);
    }
}
