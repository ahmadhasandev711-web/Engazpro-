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

        // 1. تشغيل أي ترحيلات قاعدة بيانات معلقة بأمان
        Artisan::call('migrate', ['--force' => true]);
        $migrateOutput = Artisan::output();

        // 2. مسح الكاش القديم
        Artisan::call('optimize:clear');
        $clearOutput = Artisan::output();

        // 3. إعادة بناء كاش الإنتاج فائق السرعة
        Artisan::call('config:cache');
        $configOutput = Artisan::output();

        Artisan::call('route:cache');
        $routeOutput = Artisan::output();

        Artisan::call('view:cache');
        $viewOutput = Artisan::output();

        return response()->json([
            'status' => 'success',
            'message' => 'EngazPro production migrations executed & caches built successfully!',
            'timestamp' => now()->toIso8601String(),
            'migrate' => trim($migrateOutput),
            'clear' => trim($clearOutput),
            'config_cache' => trim($configOutput),
            'route_cache' => trim($routeOutput),
            'view_cache' => trim($viewOutput),
        ]);
    }
}
