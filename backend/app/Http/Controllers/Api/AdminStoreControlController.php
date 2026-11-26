<?php

namespace App\Http\Controllers\Api;

use App\Enums\EcommercePlatform;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ConfigureStoreEasyOrdersRequest;
use App\Http\Requests\Admin\ConfigureStoreShopifyRequest;
use App\Http\Requests\Admin\ConfigureStoreWooCommerceRequest;
use App\Http\Requests\Admin\ResetMerchantPasswordRequest;
use App\Http\Requests\Admin\UpdateMerchantProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\PasswordResetRequest;
use App\Models\User;
use App\Services\AdminStoreControlService;
use App\Services\PasswordRecoveryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminStoreControlController extends Controller
{
    public function __construct(
        protected AdminStoreControlService $controlService,
        protected PasswordRecoveryService $recoveryService
    ) {}

    public function showStore(User $user): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->controlService->getStoreDetails($user),
        ]);
    }

    public function updateProfile(UpdateMerchantProfileRequest $request, User $user): JsonResponse
    {
        $updated = $this->controlService->updateStoreProfile($user, $request->validated());

        return response()->json([
            'success' => true,
            'message' => "تم تحديث بيانات متجر ({$updated->name}) بنجاح.",
            'data' => $updated,
        ]);
    }

    public function configureWooCommerce(ConfigureStoreWooCommerceRequest $request, User $user): JsonResponse
    {
        $data = $this->controlService->configureWooCommerce($user, $request->validated());

        return response()->json([
            'success' => true,
            'message' => "تم حفظ وتفعيل ربط WooCommerce لمتجر ({$user->name}) بنجاح.",
            'data' => $data,
        ]);
    }

    public function configureShopify(ConfigureStoreShopifyRequest $request, User $user): JsonResponse
    {
        $data = $this->controlService->configureShopify($user, $request->validated());

        return response()->json([
            'success' => true,
            'message' => "تم حفظ وتفعيل ربط Shopify لمتجر ({$user->name}) بنجاح.",
            'data' => $data,
        ]);
    }

    public function configureEasyOrders(ConfigureStoreEasyOrdersRequest $request, User $user): JsonResponse
    {
        $data = $this->controlService->configureEasyOrders($user, $request->validated());

        return response()->json([
            'success' => true,
            'message' => "تم حفظ وتفعيل ربط EasyOrders لمتجر ({$user->name}) بنجاح.",
            'data' => $data,
        ]);
    }

    public function removeIntegration(Request $request, User $user, EcommercePlatform $platform): JsonResponse
    {
        $disableAddon = filter_var($request->query('disable_addon', 'false'), FILTER_VALIDATE_BOOLEAN);
        $this->controlService->removeEcommerceIntegration($user, $platform, $disableAddon);

        return response()->json([
            'success' => true,
            'message' => "تمت إزالة ربط {$platform->label()} من متجر ({$user->name}) بنجاح.",
        ]);
    }

    public function testConnection(User $user): JsonResponse
    {
        $result = $this->controlService->testStoreConnection($user);

        return response()->json([
            'success' => $result['connected'],
            'message' => $result['message'],
            'data' => $result,
        ], $result['connected'] ? 200 : 422);
    }

    public function impersonate(Request $request, User $user): JsonResponse
    {
        $result = $this->controlService->impersonateMerchant($request->user(), $user);

        return response()->json([
            'success' => true,
            'message' => "تم الدخول إلى لوحة متجر ({$user->name}) بوضع الدعم الفني.",
            'data' => [
                'user' => new UserResource($result['user']),
                'token' => $result['token'],
                'impersonated_by' => $result['impersonated_by'],
            ],
        ]);
    }

    public function resetStaffPassword(ResetMerchantPasswordRequest $request, User $user, User $staff): JsonResponse
    {
        $this->controlService->resetStaffPassword($user, $staff, $request->validated('password'), $request->user());

        return response()->json([
            'success' => true,
            'message' => "تم تغيير كلمة مرور الموظف ({$staff->name}) بنجاح.",
        ]);
    }

    public function toggleStaffStatus(User $user, User $staff): JsonResponse
    {
        $updated = $this->controlService->toggleStaffStatus($user, $staff);

        return response()->json([
            'success' => true,
            'message' => "تم تحديث حالة الموظف ({$staff->name}) بنجاح.",
            'data' => $updated,
        ]);
    }

    public function forceLogoutStaff(User $user, User $staff): JsonResponse
    {
        $count = $this->controlService->forceLogoutStaff($user, $staff);

        return response()->json([
            'success' => true,
            'message' => "تم طرد جلسات الموظف ({$staff->name}) ({$count} جلسة).",
        ]);
    }

    public function queueOverview(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->controlService->getQueueOverview()]);
    }

    public function retryFailedJob(string $uuid): JsonResponse
    {
        $this->controlService->retryFailedJob($uuid);

        return response()->json(['success' => true, 'message' => 'تمت إعادة إرسال المهمة للطابور بنجاح.']);
    }

    public function retryAllFailedJobs(): JsonResponse
    {
        $this->controlService->retryAllFailedJobs();

        return response()->json(['success' => true, 'message' => 'تمت إعادة تشغيل جميع المهام الفاشلة.']);
    }

    public function flushFailedJobs(): JsonResponse
    {
        $this->controlService->flushFailedJobs();

        return response()->json(['success' => true, 'message' => 'تم تنظيف سجل المهام الفاشلة بنجاح.']);
    }

    public function passwordResetRequests(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->recoveryService->getPendingRequestsForAdmin(),
        ]);
    }

    public function dismissPasswordResetRequest(Request $request, PasswordResetRequest $resetRequest): JsonResponse
    {
        $updated = $this->recoveryService->dismissRequestForAdmin($request->user(), $resetRequest);

        return response()->json([
            'success' => true,
            'message' => 'تم إغلاق طلب الاستعادة بنجاح.',
            'data' => $updated,
        ]);
    }
}
