<?php

namespace App\Models;

use App\Enums\PartyType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Support\StoreCode;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'store_code',
        'name',
        'phone',
        'email',
        'password',
        'owner_id',
        'branch_id',
        'base_salary',
        'commission_type',
        'commission_rate',
        'role',
        'status',
        'ecommerce_enabled',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'ecommerce_enabled' => 'boolean',
            'role' => UserRole::class,
            'status' => UserStatus::class,
            'base_salary' => 'decimal:2',
            'commission_type' => \App\Enums\CommissionType::class,
            'commission_rate' => 'decimal:2',
            'permissions' => 'array',
        ];
    }

    /**
     * إلغاء توكنات الدخول القديمة للمستخدم
     */
    public function revokeTokens(?int $exceptTokenId = null): void
    {
        $query = $this->tokens();
        if ($exceptTokenId !== null) {
            $query->where('id', '!=', $exceptTokenId);
        }
        $query->delete();
    }

    protected $appends = ['business_name'];

    public function getBusinessNameAttribute(): string
    {
        if ($this->relationLoaded('settings')) {
            $setting = $this->settings->firstWhere('key', 'business_name');
            if ($setting && !empty($setting->value)) {
                return $setting->value;
            }
        }
        return $this->name;
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function employees(): HasMany
    {
        return $this->hasMany(User::class, 'owner_id');
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function getAccountId(): int
    {
        return $this->owner_id ?? $this->id;
    }

    public function isOwner(): bool
    {
        return $this->owner_id === null && ($this->role === UserRole::OWNER || $this->role?->value === UserRole::OWNER->value || $this->role === null);
    }

    public function isPartnerOrAdmin(): bool
    {
        return $this->role === UserRole::ADMIN || (bool) $this->is_admin;
    }

    public function isOwnerOrAdmin(): bool
    {
        return $this->isOwner() || $this->isPartnerOrAdmin();
    }

    public function isManager(): bool
    {
        return $this->role === UserRole::MANAGER || $this->role?->value === UserRole::MANAGER->value;
    }

    public function isSupervisor(): bool
    {
        return $this->role === UserRole::SUPERVISOR || $this->role?->value === UserRole::SUPERVISOR->value;
    }

    public function isMandob(): bool
    {
        return $this->role === UserRole::MANDOB || $this->role?->value === UserRole::MANDOB->value;
    }

    public function isCashier(): bool
    {
        return $this->role === UserRole::CASHIER || $this->role?->value === UserRole::CASHIER->value;
    }

    public function isSales(): bool
    {
        return $this->role === UserRole::SALES || $this->role?->value === UserRole::SALES->value;
    }

    /**
     * هل يمتلك المستخدم صلاحية الوصول العام لجميع الفروع؟
     * (صاحب العمل، الأدمن، والمدير العام أو المشرف العام غير المقيدين بفرع محدد)
     */
    public function hasGlobalBranchAccess(): bool
    {
        if ($this->isOwnerOrAdmin()) {
            return true;
        }

        return ($this->isManager() || $this->isSupervisor()) && $this->branch_id === null;
    }

    public function isBranchScoped(): bool
    {
        return !$this->hasGlobalBranchAccess();
    }

    public function isEligibleForPayroll(): bool
    {
        return !$this->isOwnerOrAdmin();
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(EmployeeAdjustment::class, 'employee_id');
    }

    public function payrollPayouts(): HasMany
    {
        return $this->hasMany(PayrollPayout::class, 'employee_id');
    }

    public function canViewProfits(): bool
    {
        return $this->isOwnerOrAdmin();
    }

    public function canViewPurchasePrice(): bool
    {
        return $this->isOwnerOrAdmin() || $this->isManager();
    }

    public function canManagePurchases(): bool
    {
        return $this->isOwnerOrAdmin() || $this->isManager();
    }

    public function canSettleShifts(): bool
    {
        return $this->isOwnerOrAdmin() || $this->isManager() || $this->isSupervisor();
    }

    public function treasuries(): HasMany
    {
        return $this->hasMany(Treasury::class);
    }

    public function assignedTreasury(): HasOne
    {
        return $this->hasOne(Treasury::class, 'assigned_user_id');
    }

    public function shifts(): HasMany
    {
        return $this->hasMany(Shift::class);
    }

    public function createdShifts(): HasMany
    {
        return $this->hasMany(Shift::class, 'created_by');
    }

    public function isActive(): bool
    {
        return $this->status === UserStatus::ACTIVE || $this->status?->value === UserStatus::ACTIVE->value;
    }

    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class)->latestOfMany();
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function categories(): HasMany
    {
        return $this->hasMany(Category::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(Unit::class);
    }

    public function parties(): HasMany
    {
        return $this->hasMany(Party::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Party::class)->where('type', PartyType::CUSTOMER->value);
    }

    public function suppliers(): HasMany
    {
        return $this->hasMany(Party::class)->where('type', PartyType::SUPPLIER->value);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(LedgerEntry::class);
    }

    public function settings(): HasMany
    {
        return $this->hasMany(Setting::class);
    }

    public function wooCommerceIntegration(): HasOne
    {
        return $this->hasOne(WooCommerceIntegration::class);
    }

    public function shopifyIntegration(): HasOne
    {
        return $this->hasOne(ShopifyIntegration::class);
    }

    public function easyOrdersIntegration(): HasOne
    {
        return $this->hasOne(EasyOrdersIntegration::class);
    }

    protected static function booted(): void
    {
        static::saving(function (User $user) {
            self::assignDefaultStoreIdentity($user);
        });

        static::saved(function (User $user) {
            if ($user->isDirty(['status', 'ecommerce_enabled'])) {
                $accountId = (int) ($user->owner_id ?: $user->id);
                \App\Services\SubscriptionGate::clear($accountId);
                \App\Services\WooCommerce\WooStockSyncGate::forget($accountId);
                \App\Services\Shopify\ShopifyStockSyncGate::forget($accountId);
                \App\Services\EasyOrders\EasyOrdersStockSyncGate::forget($accountId);
            }
        });
    }

    private static function assignDefaultStoreIdentity(User $user): void
    {
        if ($user->owner_id) {
            $ownerCode = static::whereKey($user->owner_id)->value('store_code');
            $user->store_code = $ownerCode ? StoreCode::normalize($ownerCode) : 'store-' . $user->owner_id;
            $user->owned_store_code = null;

            return;
        }

        if ($user->is_admin && empty($user->store_code)) {
            $user->store_code = StoreCode::ADMIN_CODE;
            $user->owned_store_code = null;

            return;
        }

        $code = !empty($user->store_code) ? StoreCode::normalize($user->store_code) : 'store-' . Str::lower(Str::random(8));
        $user->store_code = $code;
        $user->owned_store_code = $user->is_admin ? null : $code;
    }
}
