<?php

namespace App\Http\Controllers\Api\Easyfy;

use App\Http\Controllers\Controller;
use App\Http\Requests\Easyfy\Storefront\CartItemStoreRequest;
use App\Http\Requests\Easyfy\Storefront\CartItemUpdateRequest;
use App\Http\Requests\Easyfy\Storefront\CheckoutPreviewRequest;
use App\Http\Requests\Easyfy\Storefront\UploadCartArtworkRequest;
use App\Http\Resources\Easyfy\EasyfyCartResource;
use App\Services\Easyfy\EasyfyCartService;
use App\Services\Easyfy\EasyfyPricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EasyfyCartController extends Controller
{
    public function __construct(
        private readonly EasyfyCartService $cartService,
        private readonly EasyfyPricingService $pricingService
    ) {}

    public function show(Request $request): JsonResponse
    {
        $cart = $this->cartService->getCartWithRelations($request->user());

        return response()->json(['success' => true, 'data' => new EasyfyCartResource($cart)]);
    }

    public function addItem(CartItemStoreRequest $request): JsonResponse
    {
        $cart = $this->cartService->addItem($request->user(), $request->validated());

        return response()->json(['success' => true, 'data' => new EasyfyCartResource($cart)]);
    }

    public function updateItem(CartItemUpdateRequest $request, int $itemId): JsonResponse
    {
        $cart = $this->cartService->updateItem($request->user(), $itemId, $request->validated());

        return response()->json(['success' => true, 'data' => new EasyfyCartResource($cart)]);
    }

    public function removeItem(Request $request, int $itemId): JsonResponse
    {
        $cart = $this->cartService->removeItem($request->user(), $itemId);

        return response()->json(['success' => true, 'data' => new EasyfyCartResource($cart)]);
    }

    public function uploadArtwork(UploadCartArtworkRequest $request, int $itemId): JsonResponse
    {
        $cart = $this->cartService->attachItemArtwork($request->user(), $itemId, $request->file('artwork'));

        return response()->json(['success' => true, 'data' => new EasyfyCartResource($cart)]);
    }

    public function previewCheckout(CheckoutPreviewRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $preview = $this->pricingService->buildCheckoutPreview(
            $request->user(),
            isset($validated['shipping_zone_id']) ? (int) $validated['shipping_zone_id'] : null,
            $validated['coupon_code'] ?? null
        );

        return response()->json(['success' => true, 'data' => $preview]);
    }
}
