<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WooCommerceIntegration;
use App\Services\Anoofy\AnoofyConnectionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class AnoofyConnectionController extends Controller
{
    public function __construct(
        protected AnoofyConnectionService $connectionService
    ) {}

    public function generateKey(Request $request): JsonResponse
    {
        Gate::authorize('manageAnoofy', WooCommerceIntegration::class);

        $connectionKey = $this->connectionService->generateKey($request->user());

        return response()->json([
            'success' => true,
            'data' => [
                'connection_key' => $connectionKey,
            ],
        ]);
    }

    public function disconnect(Request $request): JsonResponse
    {
        Gate::authorize('manageAnoofy', WooCommerceIntegration::class);

        $this->connectionService->disconnect($request->user());

        return response()->json([
            'success' => true,
            'message' => 'تم فك ربط إضافة Anoofy بنجاح.',
        ]);
    }
}
