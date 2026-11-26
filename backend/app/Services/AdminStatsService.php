<?php

namespace App\Services;

use App\Enums\AdminAuditAction;
use App\Enums\EcommercePlatform;
use App\Enums\PasswordResetRequestStatus;
use App\Enums\StoreInquiryStatus;
use App\Enums\SubscriptionStatus;
use App\Enums\UserStatus;
use App\Services\Shopify\ShopifyStockSyncGate;
use App\Services\WooCommerce\WooStockSyncGate;
use App\Exceptions\PosDomainException;
use App\Models\ActivationCode;
use App\Models\PasswordResetRequest;
use App\Models\StoreInquiry;
use App\Models\Subscription;
use App\Models\User;
use App\Support\Money;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class AdminStatsService
{
    public function __construct(protected AdminAuditService $auditService) {}

    public function getPlatformStats(): array
    {
        $dbDriver = strtoupper(DB::connection()->getDriverName());

        return [
            'users' => $this->getUserStats(),
            'subscriptions' => $this->getSubscriptionStats(),
            'licenses' => $this->getLicenseStats(),
            'operations' => $this->getOperationStats(),
            'financials' => $this->getFinancialStats(),
            'system' => [
                'database_driver' => $dbDriver,
                'database_label' => "{$dbDriver} (Secured)",
            ],
        ];
    }

    public function getLicensesPaginated(?string $status = null, ?string $search = null, int $perPage = 50): LengthAwarePaginator
    {
        $query = ActivationCode::with('usedByUser:id,name,phone,email')->orderByDesc('id');

        if ($status === 'unused') {
            $query->where('is_used', false)->where('is_revoked', false);
        } elseif ($status === 'used') {
            $query->where('is_used', true);
        } elseif ($status === 'revoked') {
            $query->where('is_revoked', true);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('batch_reference', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhereHas('usedByUser', fn ($uq) => $uq->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"));
            });
        }

        return $query->paginate(min(max($perPage, 1), 100));
    }

    public function getUsersPaginated(?string $status = null, ?string $search = null, int $perPage = 30): LengthAwarePaginator
    {
        $query = User::whereNull('owner_id')
            ->with(['subscription', 'settings', 'wooCommerceIntegration:id,user_id,is_active', 'shopifyIntegration:id,user_id,is_active', 'easyOrdersIntegration:id,user_id,is_active'])
            ->withCount(['employees', 'branches'])
            ->orderByDesc('id');

        $this->applyUserStatusFilter($query, $status);

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('store_code', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        return $query->paginate(min(max($perPage, 1), 100))->through(fn (User $merchant) => $this->appendMerchantIntegrationState($merchant));
    }

    public function extendUserSubscription(User $user, int $days, ?string $notes = null, ?float $price = null): Subscription
    {
        return DB::transaction(function () use ($user, $days, $notes, $price) {
            $currentSub = $user->subscription;
            $today = Carbon::today();
            $baseDate = ($currentSub && Carbon::parse($currentSub->end_date)->isFuture())
                ? Carbon::parse($currentSub->end_date)
                : $today;
            $newEndDate = $baseDate->copy()->addDays($days)->toDateString();

            $subscription = $this->upsertExtendedSubscription($user, $currentSub, $today, $newEndDate, $notes, $price);
            SubscriptionGate::clear($user->id);

            $this->auditService->record(
                action: AdminAuditAction::SUBSCRIPTION_EXTENDED,
                summary: "تمديد اشتراك ({$user->name}) لمدة {$days} يوم حتى {$newEndDate}",
                targetUser: $user,
                metadata: ['days' => $days, 'end_date' => $newEndDate, 'price' => $price],
            );

            return $subscription;
        });
    }

    public function revokeUserSubscription(User $user, ?string $notes = null): Subscription
    {
        $this->assertNotAdminTarget($user);

        return DB::transaction(function () use ($user, $notes) {
            $subscription = $user->subscription;
            if (!$subscription) {
                throw new PosDomainException('لا يوجد اشتراك مسجل لهذا المتجر لإنهائه.', 'SUBSCRIPTION_NOT_FOUND', 422);
            }

            $endDate = Carbon::yesterday()->toDateString();
            $updatedNotes = $notes ? trim(($subscription->notes ?? '') . ' | ' . $notes) : $subscription->notes;
            $subscription->update([
                'status' => SubscriptionStatus::CANCELLED,
                'end_date' => $endDate,
                'notes' => $updatedNotes,
            ]);

            SubscriptionGate::clear($user->id);

            $this->auditService->record(
                action: AdminAuditAction::SUBSCRIPTION_REVOKED,
                summary: "إنهاء وإلغاء اشتراك المتجر ({$user->name})",
                targetUser: $user,
                metadata: ['end_date' => $endDate, 'notes' => $notes],
            );

            return $subscription->fresh();
        });
    }

    public function forceLogoutStore(User $user): int
    {
        $this->assertNotAdminTarget($user);

        return DB::transaction(function () use ($user) {
            $revoked = $this->revokeStoreAndStaffTokens($user);

            $this->auditService->record(
                action: AdminAuditAction::STORE_SESSIONS_REVOKED,
                summary: "طرد جميع جلسات المتجر وموظفيه ({$user->name}) - {$revoked} جلسة",
                targetUser: $user,
                metadata: ['revoked_tokens_count' => $revoked],
            );

            return $revoked;
        });
    }

    public function getStoreStaff(User $user): array
    {
        $user->loadMissing(['settings', 'branches', 'employees.branch']);

        return [
            'owner' => [
                'id' => $user->id,
                'store_code' => $user->store_code,
                'name' => $user->name,
                'phone' => $user->phone,
                'email' => $user->email,
                'business_name' => $user->business_name,
                'status' => $user->status?->value ?? UserStatus::ACTIVE->value,
            ],
            'branches' => $user->branches,
            'employees' => $user->employees,
        ];
    }

    public function toggleUserStatus(User $user): User
    {
        $this->assertNotAdminTarget($user);

        return DB::transaction(function () use ($user) {
            $newStatus = $user->status === UserStatus::INACTIVE ? UserStatus::ACTIVE : UserStatus::INACTIVE;
            $user->update(['status' => $newStatus]);

            $revoked = 0;
            if ($newStatus === UserStatus::INACTIVE) {
                $revoked = $this->revokeStoreAndStaffTokens($user);
            }

            SubscriptionGate::clear($user->id);

            $this->auditService->record(
                action: $newStatus === UserStatus::INACTIVE ? AdminAuditAction::USER_FROZEN : AdminAuditAction::USER_UNFROZEN,
                summary: ($newStatus === UserStatus::INACTIVE ? 'تجميد' : 'تنشيط') . " حساب المتجر ({$user->name})",
                targetUser: $user,
                metadata: ['new_status' => $newStatus->value, 'revoked_tokens_count' => $revoked],
            );

            return $user->fresh();
        });
    }

    public function toggleEcommerceAddon(User $user): User
    {
        $this->assertNotAdminTarget($user);

        return DB::transaction(function () use ($user) {
            $newEnabled = !$user->ecommerce_enabled;
            $user->forceFill(['ecommerce_enabled' => $newEnabled])->save();

            SubscriptionGate::clear($user->id);
            WooStockSyncGate::forget($user->id);
            ShopifyStockSyncGate::forget($user->id);

            $label = $newEnabled ? 'تفعيل' : 'إيقاف';
            $this->auditService->record(
                action: AdminAuditAction::STORE_ECOMMERCE_TOGGLED,
                summary: "{$label} موديول المتجر الإلكتروني للمتجر ({$user->name})",
                targetUser: $user,
                metadata: ['ecommerce_enabled' => $newEnabled],
            );

            return $this->appendMerchantIntegrationState($user->fresh(['subscription', 'wooCommerceIntegration:id,user_id,is_active', 'shopifyIntegration:id,user_id,is_active', 'easyOrdersIntegration:id,user_id,is_active']));
        });
    }

    private function appendMerchantIntegrationState(User $merchant): User
    {
        $activePlatform = null;
        if ($merchant->wooCommerceIntegration?->is_active) {
            $activePlatform = EcommercePlatform::WOOCOMMERCE->value;
        } elseif ($merchant->shopifyIntegration?->is_active) {
            $activePlatform = EcommercePlatform::SHOPIFY->value;
        } elseif ($merchant->easyOrdersIntegration?->is_active) {
            $activePlatform = EcommercePlatform::EASYORDERS->value;
        }
        $merchant->setAttribute('active_ecommerce_platform', $activePlatform);

        return $merchant;
    }

    public function resetUserPassword(User $user, string $newPassword): void
    {
        $this->assertNotAdminTarget($user);

        DB::transaction(function () use ($user, $newPassword) {
            $user->update(['password' => Hash::make($newPassword)]);
            $user->revokeTokens();
            app(PasswordRecoveryService::class)->resolvePendingRequestsForUser($user->id, auth()->id() ?? $user->id);

            $this->auditService->record(
                action: AdminAuditAction::USER_PASSWORD_RESET,
                summary: "إعادة تعيين كلمة مرور الحساب ({$user->name}) وإبطال الجلسات",
                targetUser: $user,
            );
        });
    }

    private function assertNotAdminTarget(User $user): void
    {
        if ($user->is_admin) {
            throw new PosDomainException('لا يمكن تنفيذ هذا الإجراء الإداري على حساب مدير عام.', 'ADMIN_TARGET_PROTECTED', 422);
        }
    }

    private function revokeStoreAndStaffTokens(User $owner): int
    {
        $employeeIds = User::where('owner_id', $owner->id)->pluck('id')->all();
        $targetIds = array_values(array_unique(array_merge([$owner->id], $employeeIds)));

        return DB::table('personal_access_tokens')
            ->where('tokenable_type', User::class)
            ->whereIn('tokenable_id', $targetIds)
            ->delete();
    }

    private function upsertExtendedSubscription(User $user, ?Subscription $currentSub, Carbon $today, string $newEndDate, ?string $notes, ?float $price): Subscription
    {
        $resolvedPrice = $price !== null ? Money::of($price)->getAmount() : null;

        if ($currentSub) {
            $payload = ['end_date' => $newEndDate, 'status' => SubscriptionStatus::ACTIVE, 'notes' => trim(($currentSub->notes ?? '') . ' | ' . ($notes ?? ''))];
            if ($resolvedPrice !== null) {
                $payload['price'] = $resolvedPrice;
            }
            $currentSub->update($payload);
            return $currentSub->fresh();
        }

        return Subscription::create([
            'user_id' => $user->id,
            'start_date' => $today->toDateString(),
            'end_date' => $newEndDate,
            'status' => SubscriptionStatus::ACTIVE,
            'plan' => 'ANNUAL',
            'price' => $resolvedPrice ?? 0.00,
            'notes' => $notes,
        ]);
    }

    private function applyUserStatusFilter($query, ?string $status): void
    {
        if ($status === 'active') {
            $query->where('status', UserStatus::ACTIVE->value);
        } elseif ($status === 'inactive') {
            $query->where('status', UserStatus::INACTIVE->value);
        } elseif ($status === 'expired') {
            $today = Carbon::today()->toDateString();
            $query->whereHas('subscription', fn ($sq) => $sq->where('end_date', '<', $today)
                ->orWhereIn('status', [SubscriptionStatus::EXPIRED->value, SubscriptionStatus::CANCELLED->value]));
        } elseif ($status === 'trial') {
            $query->whereHas('subscription', fn ($sq) => $sq->where('plan', 'TRIAL'));
        }
    }

    private function getUserStats(): array
    {
        return [
            'total' => User::count(),
            'merchants' => User::whereNull('owner_id')->count(),
            'staff' => User::whereNotNull('owner_id')->count(),
            'admins' => User::where('is_admin', true)->count(),
        ];
    }

    private function getSubscriptionStats(): array
    {
        $today = Carbon::today()->toDateString();

        return [
            'active' => Subscription::where('end_date', '>=', $today)->where('status', SubscriptionStatus::ACTIVE->value)->count(),
            'expired' => Subscription::where('end_date', '<', $today)->count(),
            'trial' => Subscription::where('plan', 'TRIAL')->where('end_date', '>=', $today)->count(),
            'paid' => Subscription::where('plan', '!=', 'TRIAL')->count(),
        ];
    }

    private function getLicenseStats(): array
    {
        return [
            'total' => ActivationCode::count(),
            'unused' => ActivationCode::where('is_used', false)->where('is_revoked', false)->count(),
            'used' => ActivationCode::where('is_used', true)->count(),
            'revoked' => ActivationCode::where('is_revoked', true)->count(),
        ];
    }

    private function getOperationStats(): array
    {
        $today = Carbon::today()->toDateString();
        $nextWeek = Carbon::today()->addDays(7)->toDateString();

        return [
            'trial_active' => Subscription::where('plan', 'TRIAL')->where('status', SubscriptionStatus::ACTIVE->value)->where('end_date', '>=', $today)->count(),
            'expiring_7d' => Subscription::where('status', SubscriptionStatus::ACTIVE->value)->whereBetween('end_date', [$today, $nextWeek])->count(),
            'pending_inquiries' => StoreInquiry::where('status', StoreInquiryStatus::NEW->value)->count(),
            'pending_reset_requests' => Schema::hasTable('password_reset_requests')
                ? PasswordResetRequest::whereNull('owner_id')->where('status', PasswordResetRequestStatus::PENDING)->count()
                : 0,
            'pending_jobs' => Schema::hasTable('jobs') ? DB::table('jobs')->count() : 0,
            'failed_jobs' => Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : 0,
        ];
    }

    private function getFinancialStats(): array
    {
        $pricing = app(PlatformPricingService::class);
        $estimated = Money::zero();
        foreach (ActivationCode::where('is_used', true)->get(['price', 'ecommerce_enabled', 'duration_days']) as $code) {
            $fallback = $pricing->resolvePlanPrice((bool) $code->ecommerce_enabled, (int) ($code->duration_days ?? 365))->getAmount();
            $estimated = $estimated->add(Money::of($code->price ?? $fallback));
        }

        $recorded = Money::zero();
        foreach (Subscription::where('price', '>', 0)->get(['price']) as $sub) {
            $recorded = $recorded->add(Money::of($sub->price));
        }

        return [
            'estimated_revenue_egp' => $estimated->getAmount(),
            'recorded_revenue_egp' => $recorded->getAmount(),
        ];
    }
}
