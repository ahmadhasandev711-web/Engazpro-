<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ResetPasswordOtpRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use App\Services\PasswordRecoveryService;
use App\Services\PlatformPricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(
        protected AuthService $authService,
        protected PlatformPricingService $pricingService,
        protected PasswordRecoveryService $recoveryService
    ) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        $trialDays = (int) $this->pricingService->getPricing()['trial_days'];
        $result = $this->authService->registerOwner($request->validated(), $trialDays);

        return response()->json([
            'success' => true,
            'message' => "تم إنشاء الحساب بنجاح وتفعيل الفترة التجريبية ({$trialDays} أيام)",
            'data' => [
                'user' => new UserResource($result['user']),
                'token' => $result['token'],
            ],
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $result = $this->authService->login($validated['store_code'], $validated['phone'], $validated['password']);

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل الدخول بنجاح',
            'data' => [
                'user' => new UserResource($result['user']),
                'token' => $result['token'],
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل الخروج بنجاح',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load([
            'branch:id,name,code,type',
            'subscription',
            'wooCommerceIntegration:id,user_id,is_active',
            'shopifyIntegration:id,user_id,is_active',
            'easyOrdersIntegration:id,user_id,is_active',
            'owner.subscription',
            'owner.wooCommerceIntegration:id,user_id,is_active',
            'owner.shopifyIntegration:id,user_id,is_active',
            'owner.easyOrdersIntegration:id,user_id,is_active',
        ]);

        return response()->json([
            'success' => true,
            'data' => new UserResource($user),
        ]);
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $this->authService->changePassword($request->user(), $validated['current_password'], $validated['new_password']);

        return response()->json([
            'success' => true,
            'message' => 'تم تغيير كلمة المرور بنجاح ✅',
        ]);
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $result = $this->recoveryService->requestRecovery($validated['store_code'], $validated['phone'], $validated['notes'] ?? null);

        return response()->json([
            'success' => true,
            'message' => $result['message'],
            'data' => $result,
        ]);
    }

    public function resetPasswordWithOtp(ResetPasswordOtpRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $this->recoveryService->resetOwnerPasswordWithOtp(
            $validated['store_code'],
            $validated['phone'],
            $validated['otp'],
            $validated['password']
        );

        return response()->json([
            'success' => true,
            'message' => 'تم تعيين كلمة المرور الجديدة بنجاح. يمكنك الآن تسجيل الدخول.',
        ]);
    }
}
