<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

class DeployMaintenanceController extends Controller
{
    /**
     * مسح كاش التطبيق بأمان تام لبيئات الاستضافة المشتركة بدون SSH.
     * محمي بـ Throttle مشدد (5 محاولات في الدقيقة) ومفتاح تشفير عالي التعقيد مع ثبات زمني لمنع التخمين.
     */
    public function clearCache(Request $request): JsonResponse
    {
        $expectedToken = config('app.deploy_sync_secret') ?: env('DEPLOY_SYNC_SECRET', 'ep_sec_8f92a1c0d4e7b65398214fa38de05cb194');
        $providedToken = (string) ($request->query('token') ?: $request->header('X-Deploy-Token'));

        if (empty($providedToken) || !hash_equals($expectedToken, $providedToken)) {
            usleep(250000); // 250ms timing throttle against brute force
            abort(403, 'Access denied.');
        }

        Artisan::call('optimize:clear');
        $output = Artisan::output();

        return response()->json([
            'status' => 'success',
            'message' => 'EngazPro production cache cleared successfully!',
            'timestamp' => now()->toIso8601String(),
            'output' => trim($output),
        ]);
    }
}
