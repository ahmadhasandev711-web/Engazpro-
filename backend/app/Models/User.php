<?php

namespace App\Models;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'password',
        'is_admin',
        'owner_id',
        'branch_id',
        'base_salary',
        'commission_type',
        'commission_rate',
        'role',
        'status',
        'permissions',
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
            'role' => UserRole::class,
            'status' => UserStatus::class,
            'base_salary' => 'decimal:2',
            'commission_type' => \App\Enums\CommissionType::class,
            'commission_rate' => 'decimal:2',
            'permissions' => 'array',
        ];
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
        return $this->owner_id === null && ($this->role === UserRole::OWNER || $this->role?->value === 'OWNER' || $this->role === null);
    }

    public function isPartnerOrAdmin(): bool
    {
        return $this->role?->value === 'ADMIN' || (bool) $this->is_admin;
    }

    public function isOwnerOrAdmin(): bool
    {
        return $this->isOwner() || $this->isPartnerOrAdmin();
    }

    public function isManager(): bool
    {
        return $this->role === UserRole::MANAGER || $this->role?->value === 'MANAGER';
    }

    public function isSupervisor(): bool
    {
        return $this->role === UserRole::SUPERVISOR || $this->role?->value === 'SUPERVISOR';
    }

    public function isMandob(): bool
    {
        return $this->role === UserRole::MANDOB || $this->role?->value === 'MANDOB';
    }

    public function isCashier(): bool
    {
        return $this->role === UserRole::CASHIER || $this->role?->value === 'CASHIER';
    }

    public function isSales(): bool
    {
        return $this->role === UserRole::SALES || $this->role?->value === 'SALES';
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
        return $this->status === UserStatus::ACTIVE || $this->status?->value === 'ACTIVE';
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
        return $this->hasMany(Party::class)->where('type', 'CUSTOMER');
    }

    public function suppliers(): HasMany
    {
        return $this->hasMany(Party::class)->where('type', 'SUPPLIER');
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
}
