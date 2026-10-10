<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivationCodeService;
use App\Services\AdminStatsService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function __construct(
        protected ActivationCodeService $codeService,
        protected AdminStatsService $statsService
    ) {}

    /**
     * إحصائيات عامة للمنصة (KPIs)
     */
    public function stats(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->statsService->getPlatformStats(),
        ]);
    }

    /**
     * استعراض كافة أكواد التفعيل
     */
    public function licenses(Request $request): JsonResponse
    {
        $status = $request->query('status'); // 'all', 'unused', 'used'
        $search = $request->query('search');

        $licenses = $this->statsService->getLicensesPaginated($status, $search, 50);

        return response()->json([
            'success' => true,
            'data' => $licenses,
        ]);
    }

    /**
     * توليد دفعة أكواد تفعيل جديدة
     */
    public function generateLicenses(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'count' => ['required', 'integer', 'min:1', 'max:100'],
            'duration_days' => ['required', 'integer', 'min:1', 'max:3650'],
            'plan' => ['nullable', 'string'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $count = (int) $validated['count'];
        $days = (int) $validated['duration_days'];
        $plan = $validated['plan'] ?? 'BASIC';
        $notes = $validated['notes'] ?? ('دفعة مولدة من لوحة الأدمن - ' . Carbon::now()->toDateTimeString());

        $codes = $this->codeService->generateCodes($count, $days, $plan, $notes);

        return response()->json([
            'success' => true,
            'message' => "تم توليد {$count} كود تفعيل بنجاح لمدة {$days} يوم",
            'data' => $codes,
        ], 201);
    }

    /**
     * استعراض قائمة المشتركين والتجار
     */
    public function users(Request $request): JsonResponse
    {
        $search = $request->query('search');
        $status = $request->query('status'); // 'all', 'active', 'expired', 'trial'

        $users = $this->statsService->getUsersPaginated($status, $search, 30);

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    /**
     * تمديد اشتراك مستخدم يدوياً
     */
    public function extendUser(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'days' => ['required', 'integer', 'min:1', 'max:3650'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $days = (int) $validated['days'];
        $notes = $validated['notes'] ?? 'تمديد يدوي من لوحة تحكم المدير العام';

        $subscription = $this->statsService->extendUserSubscription($user, $days, $notes);

        return response()->json([
            'success' => true,
            'message' => "تم تمديد اشتراك المستخدم ({$user->name}) بنجاح لمدة {$days} يوم إضافي حتى {$subscription->end_date}",
            'data' => $subscription,
        ]);
    }

    /**
     * تجميد / تنشيط حساب تاجر (Kill-Switch)
     */
    public function toggleStatus(User $user): JsonResponse
    {
        try {
            $updatedUser = $this->statsService->toggleUserStatus($user);
            $actionWord = $updatedUser->status?->value === 'ACTIVE' ? 'تنشيط' : 'تجميد';

            return response()->json([
                'success' => true,
                'message' => "تم {$actionWord} حساب المتجر ({$user->name}) بنجاح.",
                'data' => $updatedUser,
            ]);
        } catch (\DomainException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * فحص فريق العمل وفروع التاجر
     */
    public function storeStaff(User $user): JsonResponse
    {
        $data = $this->statsService->getStoreStaff($user);

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * إلغاء وحرق كود تفعيل غير مستخدم
     */
    public function revokeLicense(int $id): JsonResponse
    {
        $code = $this->codeService->revokeCode($id);

        return response()->json([
            'success' => true,
            'message' => "تم إلغاء وحرق كود التفعيل ({$code->code}) بنجاح ومنع استخدامه نهائياً.",
            'data' => $code,
        ]);
    }

    /**
     * إعادة تعيين كلمة مرور تاجر/مستخدم من لوحة تحكم الأدمن
     */
    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'min:6'],
        ], [
            'password.required' => 'كلمة المرور الجديدة مطلوبة',
            'password.min' => 'كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام',
        ]);

        $this->statsService->resetUserPassword($user, $validated['password']);

        return response()->json([
            'success' => true,
            'message' => "تم تغيير كلمة المرور للمستخدم ({$user->name}) بنجاح.",
        ]);
    }
}
