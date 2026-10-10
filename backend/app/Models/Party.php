<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Party extends Model
{
    use SoftDeletes, BelongsToStore;

    protected $fillable = [
        'user_id',
        'type', // CUSTOMER, SUPPLIER
        'name',
        'phone',
        'phone2',
        'address',
        'balance',
        'notes',
        'wc_customer_id',
        'wc_email',
    ];

    protected $casts = [
        'wc_customer_id' => 'integer',
        'balance' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(LedgerEntry::class)->orderBy('date', 'desc')->orderBy('id', 'desc');
    }

    public function courierInvoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'courier_party_id');
    }

    public function courierOrders(): HasMany
    {
        return $this->hasMany(WcOrder::class, 'courier_party_id');
    }

    public function scopeCustomers(Builder $query): Builder
    {
        return $query->where('type', 'CUSTOMER');
    }

    public function scopeSuppliers(Builder $query): Builder
    {
        return $query->where('type', 'SUPPLIER');
    }

    public function scopeCouriers(Builder $query): Builder
    {
        return $query->where('type', 'COURIER');
    }
}
