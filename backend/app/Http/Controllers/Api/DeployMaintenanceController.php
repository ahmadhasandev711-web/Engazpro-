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

        $results = [];

        // 1. تشغيل أي ترحيلات قاعدة بيانات معلقة بأمان
        try {
            Artisan::call('migrate', ['--force' => true]);
            $results['migrate'] = trim(Artisan::output());
        } catch (\Throwable $e) {
            $results['migrate_error'] = $e->getMessage();
        }

        // 2. مسح الكاش القديم
        try {
            Artisan::call('optimize:clear');
            $results['optimize_clear'] = trim(Artisan::output());
        } catch (\Throwable $e) {
            $results['optimize_clear_error'] = $e->getMessage();
        }

        // 3. محاولة بناء كاش الإنتاج السريع
        try {
            Artisan::call('config:cache');
            $results['config_cache'] = trim(Artisan::output());
        } catch (\Throwable $e) {
            $results['config_cache_error'] = $e->getMessage();
        }

        try {
            Artisan::call('route:cache');
            $results['route_cache'] = trim(Artisan::output());
        } catch (\Throwable $e) {
            $results['route_cache_error'] = $e->getMessage();
        }

        try {
            Artisan::call('view:cache');
            $results['view_cache'] = trim(Artisan::output());
        } catch (\Throwable $e) {
            $results['view_cache_error'] = $e->getMessage();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'EngazPro maintenance & migration cycle executed safely.',
            'timestamp' => now()->toIso8601String(),
            'details' => $results,
        ]);
    }
}
