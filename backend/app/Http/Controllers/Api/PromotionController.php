<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EvaluatePromotionRequest;
use App\Http\Requests\PromotionRequest;
use App\Http\Resources\PromotionResource;
use App\Models\Promotion;
use App\Services\PromotionEngineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class PromotionController extends Controller
{
    public function __construct(
        protected PromotionEngineService $promotionService
    ) {}

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Promotion::class);
        $promos = $this->promotionService->listForUser($request->user());

        return response()->json([
            'success' => true,
            'data' => PromotionResource::collection($promos),
        ]);
    }

    public function store(PromotionRequest $request): JsonResponse
    {
        Gate::authorize('create', Promotion::class);
        $promo = $this->promotionService->createPromotion($request->user(), $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء العرض بنجاح',
            'data' => new PromotionResource($promo),
        ], 201);
    }

    public function update(PromotionRequest $request, int $id): JsonResponse
    {
        $promotion = $this->promotionService->findOrFail($id);
        Gate::authorize('update', $promotion);
        $updated = $this->promotionService->updatePromotion($request->user(), $promotion, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث العرض بنجاح',
            'data' => new PromotionResource($updated),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $promotion = $this->promotionService->findOrFail($id);
        Gate::authorize('delete', $promotion);
        $this->promotionService->deletePromotion($promotion);

        return response()->json([
            'success' => true,
            'message' => 'تم حذف العرض بنجاح',
        ]);
    }

    public function evaluate(EvaluatePromotionRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $result = $this->promotionService->evaluateCart(
            user: $request->user(),
            items: $validated['items'],
            couponCode: $validated['coupon_code'] ?? null,
            branchId: isset($validated['branch_id']) ? (int) $validated['branch_id'] : null,
            throwOnInvalidCoupon: !empty($validated['coupon_code'])
        );

        unset($result['promotion_discount_money']);

        return response()->json(['success' => true, 'data' => $result]);
    }
}
