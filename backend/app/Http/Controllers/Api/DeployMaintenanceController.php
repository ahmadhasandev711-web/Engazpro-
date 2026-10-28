<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DeployCacheRefreshService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeployMaintenanceController extends Controller
{
    /**
     * مسح كاش الإنتاج على استضافة بدون SSH.
     * السر من config('pos.deploy_sync_secret') فقط. لا ترحيلات من هذا المسار.
     */
    public function clearCache(Request $request, DeployCacheRefreshService $cache): JsonResponse
    {
        $this->authorizeDeployToken($request);

        return response()->json([
            'status' => 'success',
            'message' => 'تم تحديث كاش التطبيق.',
            'timestamp' => now()->toIso8601String(),
            'details' => $cache->refresh(),
        ]);
    }

    private function authorizeDeployToken(Request $request): void
    {
        $expectedToken = (string) config('pos.deploy_sync_secret', '');
        $providedToken = (string) ($request->query('token') ?: $request->header('X-Deploy-Token'));

        if ($expectedToken === '' || $providedToken === '' || ! hash_equals($expectedToken, $providedToken)) {
            usleep(250000);
            abort(403, 'Access denied.');
        }
    }
}
