<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Resources\UserResource;
use App\Models\Subscription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Services\StoreBootstrapService;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function __construct(
        protected StoreBootstrapService $bootstrapService
    ) {}

    /**
     * تسجيل حساب جديد مع إنشاء اشتراك سنوي تلقائي
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = DB::transaction(function () use ($validated) {
            $user = User::create([
                'name' => $validated['name'],
                'phone' => $validated['phone'],
                'email' => $validated['email'] ?? null,
                'password' => Hash::make($validated['password']),
                'status' => UserStatus::ACTIVE,
            ]);
            $user->role = UserRole::OWNER;
            $user->save();

            // إنشاء فترة تجريبية مجانية بناءً على إعدادات المنصة
            $trialDays = (int) config('pos.trial_days', 7);
            Subscription::create([
                'user_id' => $user->id,
                'start_date' => Carbon::today()->toDateString(),
                'end_date' => Carbon::today()->addDays($trialDays)->toDateString(),
                'status' => 'ACTIVE',
                'plan' => 'TRIAL',
                'price' => 0.00,
                'notes' => "فترة تجريبية مجانية ({$trialDays} أيام)",
            ]);

            // التهيئة الفورية للمتجر (الفرع، الخزائن، العميل النقدي، التصنيف، وصنف تجريبي جاهز)
            $this->bootstrapService->bootstrapNewStore($user);

            return $user;
        });

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء الحساب بنجاح وتفعيل الفترة التجريبية (7 أيام)',
            'data' => [
                'user' => new UserResource($user->load('subscription')),
                'token' => $token,
            ],
        ], 201);
    }

    /**
     * تسجيل الدخول
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $identifier = $validated['phone'];

        $user = User::where(function ($q) use ($identifier) {
            $q->where('phone', $identifier)
              ->orWhere('email', $identifier);

            if (str_starts_with($identifier, '01') && strlen($identifier) === 11) {
                $q->orWhere('phone', '2' . $identifier)
                  ->orWhere('phone', '+2' . $identifier);
            } elseif (str_starts_with($identifier, '201') && strlen($identifier) === 12) {
                $q->orWhere('phone', '0' . substr($identifier, 2))
                  ->orWhere('phone', '+' . $identifier);
            } elseif (str_starts_with($identifier, '+201') && strlen($identifier) === 13) {
                $q->orWhere('phone', '0' . substr($identifier, 3))
                  ->orWhere('phone', substr($identifier, 1));
            }
        })->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'بيانات الدخول أو كلمة المرور غير صحيحة',
            ], 422);
        }

        if (!$user->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'تم إيقاف حسابك من قبل صاحب العمل. يرجى مراجعة إدارة المؤسسة.',
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل الدخول بنجاح',
            'data' => [
                'user' => new UserResource($user->load('subscription')),
                'token' => $token,
            ],
        ]);
    }

    /**
     * تسجيل الخروج
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل الخروج بنجاح',
        ]);
    }

    /**
     * جلب بيانات المستخدم الحالي
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('subscription');

        return response()->json([
            'success' => true,
            'data' => new UserResource($user),
        ]);
    }

    /**
     * تغيير كلمة المرور للمستخدم المسجل الحالي
     */
    public function changePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'new_password' => ['required', 'string', 'min:6', 'confirmed'],
        ], [
            'current_password.required' => 'يرجى إدخال كلمة المرور الحالية',
            'new_password.required' => 'يرجى إدخال كلمة المرور الجديدة',
            'new_password.min' => 'يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف',
            'new_password.confirmed' => 'تأكيد كلمة المرور الجديدة غير متطابق',
        ]);

        $user = $request->user();

        if (!Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'كلمة المرور الحالية غير صحيحة',
            ], 422);
        }

        $user->update([
            'password' => Hash::make($validated['new_password']),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم تغيير كلمة المرور بنجاح ✅',
        ]);
    }
}

