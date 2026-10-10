<?php

namespace App\Services;

use App\Models\ActivationCode;
use App\Models\Invoice;
use App\Models\Party;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class AdminStatsService
{
    /**
     * إحصائيات عامة للمنصة (KPIs)
     */
    public function getPlatformStats(): array
    {
        $totalUsers = User::count();
        $adminCount = User::where('is_admin', true)->count();
        $merchantCount = User::whereNull('owner_id')->count();
        $staffCount = User::whereNotNull('owner_id')->count();

        $now = Carbon::today();
        
        $activeSubscriptions = Subscription::where('end_date', '>=', $now->toDateString())
            ->where('status', 'ACTIVE')
            ->count();

        $expiredSubscriptions = Subscription::where('end_date', '<', $now->toDateString())
            ->count();

        $trialSubscriptions = Subscription::where('plan', 'TRIAL')
            ->where('end_date', '>=', $now->toDateString())
            ->count();

        $paidSubscriptions = Subscription::where('plan', '!=', 'TRIAL')
            ->count();

        $totalLicenses = ActivationCode::count();
        $unusedLicenses = ActivationCode::where('is_used', false)->where('is_revoked', false)->count();
        $usedLicenses = ActivationCode::where('is_used', true)->count();
        $revokedLicenses = ActivationCode::where('is_revoked', true)->count();

        $totalInvoices = Invoice::count();
        $totalProducts = Product::count();
        $totalParties = Party::count();

        $annualPrice = (float) config('pos.annual_subscription_price', 500);
        $estimatedRevenue = $usedLicenses * $annualPrice;

        $dbDriver = strtoupper(DB::connection()->getDriverName());
        $dbName = DB::connection()->getDatabaseName();

        return [
            'users' => [
                'total' => $totalUsers,
                'merchants' => $merchantCount,
                'staff' => $staffCount,
                'admins' => $adminCount,
            ],
            'subscriptions' => [
                'active' => $activeSubscriptions,
                'expired' => $expiredSubscriptions,
                'trial' => $trialSubscriptions,
                'paid' => $paidSubscriptions,
            ],
            'licenses' => [
                'total' => $totalLicenses,
                'unused' => $unusedLicenses,
                'used' => $usedLicenses,
                'revoked' => $revokedLicenses,
            ],
            'activity' => [
                'invoices' => $totalInvoices,
                'products' => $totalProducts,
                'parties' => $totalParties,
            ],
            'financials' => [
                'estimated_revenue_egp' => $estimatedRevenue,
            ],
            'system' => [
                'database_driver' => $dbDriver,
                'database_name' => $dbName,
                'database_label' => "{$dbDriver} ({$dbName})",
            ],
        ];
    }

    /**
     * استعلام رخص التفعيل مع الفلترة والصفحات
     */
    public function getLicensesPaginated(?string $status = null, ?string $search = null, int $perPage = 50): LengthAwarePaginator
    {
        $query = ActivationCode::with('usedByUser:id,name,phone,email')
            ->orderBy('id', 'desc');

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
                  ->orWhereHas('usedByUser', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%")
                         ->orWhere('phone', 'like', "%{$search}%");
                  });
            });
        }

        return $query->paginate($perPage);
    }

    /**
     * استعلام المشتركين والتجار مع الفلترة والصفحات (المتاجر وأصحاب العمل فقط)
     */
    public function getUsersPaginated(?string $status = null, ?string $search = null, int $perPage = 30): LengthAwarePaginator
    {
        $query = User::whereNull('owner_id')
            ->with(['subscription', 'settings'])
            ->withCount(['employees', 'branches', 'invoices', 'products', 'parties'])
            ->orderBy('id', 'desc');

        if ($status === 'active') {
            $query->where('status', 'ACTIVE');
        } elseif ($status === 'inactive') {
            $query->where('status', 'INACTIVE');
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        return $query->paginate($perPage);
    }

    /**
     * تمديد اشتراك مستخدم يدوياً
     */
    public function extendUserSubscription(User $user, int $days, ?string $notes = null): Subscription
    {
        return DB::transaction(function () use ($user, $days, $notes) {
            $currentSub = $user->subscription;
            $today = Carbon::today();

            $baseDate = $today;
            if ($currentSub && Carbon::parse($currentSub->end_date)->isFuture()) {
                $baseDate = Carbon::parse($currentSub->end_date);
            }

            $newEndDate = $baseDate->copy()->addDays($days)->toDateString();

            if ($currentSub) {
                $currentSub->update([
                    'end_date' => $newEndDate,
                    'status' => 'ACTIVE',
                    'notes' => trim(($currentSub->notes ?? '') . ' | ' . ($notes ?? '')),
                ]);
                return $currentSub;
            }

            return Subscription::create([
                'user_id' => $user->id,
                'start_date' => $today->toDateString(),
                'end_date' => $newEndDate,
                'status' => 'ACTIVE',
                'plan' => 'ANNUAL',
                'price' => 0.00,
                'notes' => $notes,
            ]);
        });
    }

    /**
     * فحص فريق العمل والفروع لتاجر معين
     */
    public function getStoreStaff(User $user): array
    {
        $user->loadMissing(['settings', 'branches', 'employees.branch']);

        return [
            'owner' => [
                'id' => $user->id,
                'name' => $user->name,
                'phone' => $user->phone,
                'email' => $user->email,
                'business_name' => $user->business_name,
                'status' => $user->status?->value ?? 'ACTIVE',
            ],
            'branches' => $user->branches,
            'employees' => $user->employees,
        ];
    }

    /**
     * تجميد / إعادة تنشيط حساب تاجر (Kill-Switch)
     */
    public function toggleUserStatus(User $user): User
    {
        if ($user->is_admin) {
            throw new \DomainException('لا يمكن تجميد أو إيقاف حساب الإدارة العامة الجذري.');
        }

        return DB::transaction(function () use ($user) {
            $newStatus = ($user->status === \App\Enums\UserStatus::INACTIVE || $user->status?->value === 'INACTIVE')
                ? \App\Enums\UserStatus::ACTIVE
                : \App\Enums\UserStatus::INACTIVE;

            $user->update(['status' => $newStatus]);
            return $user->fresh();
        });
    }

    /**
     * تغيير كلمة مرور مستخدم/تاجر يدوياً من لوحة الأدمن
     */
    public function resetUserPassword(User $user, string $newPassword): void
    {
        $user->update([
            'password' => \Illuminate\Support\Facades\Hash::make($newPassword),
        ]);
    }
}
