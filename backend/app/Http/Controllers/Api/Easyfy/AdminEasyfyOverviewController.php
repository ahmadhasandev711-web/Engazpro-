<?php

namespace App\Http\Controllers\Api\Easyfy;

use App\Http\Controllers\Controller;
use App\Services\Easyfy\EasyfyAnalyticsService;
use Illuminate\Http\JsonResponse;

class AdminEasyfyOverviewController extends Controller
{
    public function __construct(private readonly EasyfyAnalyticsService $analyticsService) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->analyticsService->getCommandCenterOverview(),
        ]);
    }

    public function demandReport(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->analyticsService->getUnlimitedAndTopDemandReport(),
        ]);
    }
}
