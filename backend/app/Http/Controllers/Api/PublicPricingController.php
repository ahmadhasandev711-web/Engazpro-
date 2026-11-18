<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PlatformPricingService;
use Illuminate\Http\JsonResponse;

class PublicPricingController extends Controller
{
    public function __construct(
        protected PlatformPricingService $pricingService
    ) {}

    public function __invoke(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->pricingService->getPricing(),
        ]);
    }
}
