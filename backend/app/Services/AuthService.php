<?php

namespace App\Services;

use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exceptions\PosDomainException;
use App\Models\Subscription;
use App\Models\User;
use App\Support\PhoneNormalizer;
use App\Support\StoreCode;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;

class AuthService
{
    public function __construct(
        protected StoreBootstrapService $bootstrapService
    ) {}

    public function registerOwner(array $validated, int $trialDays): array
    {
        $storeCode = StoreCode::normalize($validated['store_code']);
        $user = DB::transaction(function () use ($validated, $trialDays, $storeCode) {
            $user = new User([
                'store_code' => $storeCode,
                'name' => $validated['name'],
                'phone' => $validated['phone'],
                'email' => $validated['email'] ?? null,
                'password' => Hash::make($validated['password']),
                'status' => UserStatus::ACTIVE,
            ]);
            $user->owned_store_code = $storeCode;
            $user->role = UserRole::OWNER;
            $user->ecommerce_enabled = true;
            $user->save();

            $this->createTrialSubscription($user, $trialDays);
            $this->bootstrapService->bootstrapNewStore($user);

            return $user;
        });

        return [
            'user' => $user->load(['subscription', 'branch:id,name,code,type']),
            'token' => $user->createToken('auth_token')->plainTextToken,
        ];
    }

    public function login(string $storeCode, string $identifier, string $password): array
    {
        $user = $this->findByStoreAndIdentifier($storeCode, $identifier);

        if (!$user || !Hash::check($password, $user->password)) {
            throw new PosDomainException('بيانات الدخول أو كلمة المرور غير صحيحة', 'INVALID_CREDENTIALS', 422);
        }

        if (!$user->isActive()) {
            throw new PosDomainException('تم إيقاف حسابك من قبل صاحب العمل. يرجى مراجعة إدارة المؤسسة.', 'ACCOUNT_INACTIVE', 403);
        }

        return [
            'user' => $user->load(['subscription', 'branch:id,name,code,type']),
            'token' => $user->createToken('auth_token')->plainTextToken,
        ];
    }

    public function changePassword(User $user, string $currentPassword, string $newPassword): void
    {
        if (!Hash::check($currentPassword, $user->password)) {
            throw new PosDomainException('كلمة المرور الحالية غير صحيحة', 'INVALID_CURRENT_PASSWORD', 422);
        }

        $user->update(['password' => Hash::make($newPassword)]);
        $currentToken = $user->currentAccessToken();
        $tokenId = ($currentToken instanceof PersonalAccessToken) ? $currentToken->id : null;
        $user->revokeTokens($tokenId);
    }

    protected function createTrialSubscription(User $user, int $trialDays): void
    {
        Subscription::create([
            'user_id' => $user->id,
            'start_date' => Carbon::today()->toDateString(),
            'end_date' => Carbon::today()->addDays($trialDays)->toDateString(),
            'status' => SubscriptionStatus::ACTIVE,
            'plan' => 'TRIAL',
            'price' => 0.00,
            'notes' => "فترة تجريبية مجانية ({$trialDays} أيام)",
        ]);
    }

    protected function findByStoreAndIdentifier(string $storeCode, string $identifier): ?User
    {
        $code = StoreCode::normalize($storeCode);
        $query = StoreCode::isAdminCode($code)
            ? User::where('is_admin', true)
            : User::where('store_code', $code);

        $variants = PhoneNormalizer::variants($identifier);
        $lowerEmail = strtolower(trim($identifier));

        return $query->where(function ($q) use ($lowerEmail, $variants) {
            $q->whereIn('phone', $variants)->orWhere('email', $lowerEmail);
        })->first();
    }
}
