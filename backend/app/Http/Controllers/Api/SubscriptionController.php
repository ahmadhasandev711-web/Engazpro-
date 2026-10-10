<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SubscriptionResource;
use App\Models\Subscription;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    /**
     * جلب حالة وتفاصيل الاشتراك
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();
        $subscription = $user->subscription;

        if (!$subscription) {
            return response()->json([
                'success' => false,
                'message' => 'لا يوجد اشتراك مسجل لهذا الحساب',
                'data' => null,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => new SubscriptionResource($subscription),
        ]);
    }

    /**
     * تفعيل الاشتراك باستخدام كود تفعيل آمن وأحادي الاستخدام
     */
    public function activateCode(Request $request, \App\Services\ActivationCodeService $activationService): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'min:6', 'max:64'],
        ], [
            'code.required' => 'يُرجى إدخال كود التفعيل',
            'code.string' => 'صيغة كود التفعيل غير صالحة',
        ]);

        $result = $activationService->redeemCode($request->user(), $request->input('code'));

        return response()->json([
            'success' => true,
            'message' => $result['message'],
            'data' => $result,
        ]);
    }
}
