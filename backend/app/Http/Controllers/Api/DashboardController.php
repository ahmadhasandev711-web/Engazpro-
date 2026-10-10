<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(
        protected DashboardService $dashboardService
    ) {}

    /**
     * لوحة القيادة السريعة للمندوب والمدير
     */
    public function index(Request $request): JsonResponse
    {
        $data = $this->dashboardService->getDashboardData($request->user());

        return response()->json(['data' => $data]);
    }
}
