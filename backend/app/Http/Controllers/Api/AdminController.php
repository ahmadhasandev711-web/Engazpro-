<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ExtendSubscriptionRequest;
use App\Http\Requests\Admin\GenerateLicensesRequest;
use App\Http\Requests\Admin\ResetMerchantPasswordRequest;
use App\Http\Requests\Admin\RevokeSubscriptionRequest;
use App\Http\Requests\Admin\UpdatePlatformPricingRequest;
use App\Models\User;
use App\Services\ActivationCodeService;
use App\Services\AdminAuditService;
use App\Services\AdminStatsService;
use App\Services\PlatformPricingService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function __construct(
        protected ActivationCodeService $codeService,
        protected AdminStatsService $statsService,
        protected AdminAuditService $auditService,
        protected PlatformPricingService $pricingService,
    ) {}

    public function stats(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->statsService->getPlatformStats(),
        ]);
    }

    public function licenses(Request $request): JsonResponse
    {
        $licenses = $this->statsService->getLicensesPaginated(
            $request->query('status'),
            $request->query('search'),
            (int) $request->query('per_page', 50),
        );

        return response()->json(['success' => true, 'data' => $licenses]);
    }

    public function generateLicenses(GenerateLicensesRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $count = (int) $validated['count'];
        $days = (int) $validated['duration_days'];
        $plan = $validated['plan'] ?? ($validated['ecommerce_enabled'] ?? false ? 'PRO_ECOMMERCE' : 'BASIC');
        $price = isset($validated['price']) ? (string) $validated['price'] : null;
        $ecommerceEnabled = (bool) ($validated['ecommerce_enabled'] ?? false);
        $notes = $validated['notes'] ?? ('دفعة مولدة من لوحة الأدمن - ' . Carbon::now()->toDateTimeString());

        $codes = $this->codeService->generateCodes($count, $days, $plan, $notes, $price !== null ? $price + 0 : null, $ecommerceEnabled);

        return response()->json([
            'success' => true,
            'message' => "تم توليد {$count} كود تفعيل بنجاح لمدة {$days} يوم",
            'data' => $codes,
        ], 201);
    }

    public function users(Request $request): JsonResponse
    {
        $users = $this->statsService->getUsersPaginated(
            $request->query('status'),
            $request->query('search'),
            (int) $request->query('per_page', 30),
        );

        return response()->json(['success' => true, 'data' => $users]);
    }

    public function extendUser(ExtendSubscriptionRequest $request, User $user): JsonResponse
    {
        $validated = $request->validated();
        $days = (int) $validated['days'];
        $notes = $validated['notes'] ?? 'تمديد يدوي من لوحة تحكم المدير العام';
        $price = isset($validated['price']) ? $validated['price'] + 0 : null;

        $subscription = $this->statsService->extendUserSubscription($user, $days, $notes, $price);

        return response()->json([
            'success' => true,
            'message' => "تم تمديد اشتراك المستخدم ({$user->name}) بنجاح لمدة {$days} يوم إضافي حتى {$subscription->end_date}",
            'data' => $subscription,
        ]);
    }

    public function revokeSubscription(RevokeSubscriptionRequest $request, User $user): JsonResponse
    {
        $subscription = $this->statsService->revokeUserSubscription($user, $request->validated('notes'));

        return response()->json([
            'success' => true,
            'message' => "تم إنهاء وإلغاء اشتراك المتجر ({$user->name}) بنجاح.",
            'data' => $subscription,
        ]);
    }

    public function forceLogout(User $user): JsonResponse
    {
        $revokedCount = $this->statsService->forceLogoutStore($user);

        return response()->json([
            'success' => true,
            'message' => "تم طرد جميع جلسات المتجر ({$user->name}) وموظفيه ({$revokedCount} جلسة).",
            'data' => ['revoked_tokens_count' => $revokedCount],
        ]);
    }

    public function toggleStatus(User $user): JsonResponse
    {
        $updatedUser = $this->statsService->toggleUserStatus($user);
        $actionWord = $updatedUser->status === UserStatus::ACTIVE ? 'تنشيط' : 'تجميد';

        return response()->json([
            'success' => true,
            'message' => "تم {$actionWord} حساب المتجر ({$user->name}) بنجاح.",
            'data' => $updatedUser,
        ]);
    }

    public function toggleEcommerce(User $user): JsonResponse
    {
        $updatedUser = $this->statsService->toggleEcommerceAddon($user);
        $actionWord = $updatedUser->ecommerce_enabled ? 'تفعيل' : 'إيقاف';

        return response()->json([
            'success' => true,
            'message' => "تم {$actionWord} موديول المتجر الإلكتروني لمتجر ({$user->name}) بنجاح.",
            'data' => $updatedUser,
        ]);
    }

    public function storeStaff(User $user): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->statsService->getStoreStaff($user),
        ]);
    }

    public function revokeLicense(int $id): JsonResponse
    {
        $code = $this->codeService->revokeCode($id);

        return response()->json([
            'success' => true,
            'message' => "تم إلغاء وحرق كود التفعيل ({$code->code}) بنجاح ومنع استخدامه نهائياً.",
            'data' => $code,
        ]);
    }

    public function resetPassword(ResetMerchantPasswordRequest $request, User $user): JsonResponse
    {
        $this->statsService->resetUserPassword($user, $request->validated('password'));

        return response()->json([
            'success' => true,
            'message' => "تم تغيير كلمة المرور للمستخدم ({$user->name}) بنجاح.",
        ]);
    }

    public function auditLogs(Request $request): JsonResponse
    {
        $logs = $this->auditService->getLogsPaginated(
            $request->query('action'),
            $request->query('search'),
            (int) $request->query('per_page', 30),
        );

        return response()->json(['success' => true, 'data' => $logs]);
    }

    public function getPricing(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->pricingService->getPricing(),
        ]);
    }

    public function updatePricing(UpdatePlatformPricingRequest $request): JsonResponse
    {
        $updated = $this->pricingService->updatePricing($request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث تسعير باقات المنصة وربطه بصفحة الأسعار وأكواد التفعيل بنجاح.',
            'data' => $updated,
        ]);
    }
}
