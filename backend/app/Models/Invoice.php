<?php

namespace App\Models;

use App\Enums\InvoiceType;
use App\Enums\PaymentMethod;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Invoice extends Model
{
    use SoftDeletes, BelongsToStore;

    protected $fillable = [
        'user_id',
        'branch_id',
        'created_by',
        'salesperson_id',
        'treasury_id',
        'shift_id',
        'invoice_number',
        'idempotency_key',
        'type', // SALE, PURCHASE, SALE_RETURN, PURCHASE_RETURN
        'party_id',
        'courier_party_id',
        'parent_invoice_id',
        'date',
        'subtotal',
        'discount',
        'tax',
        'total',
        'paid_amount',
        'remaining_amount',
        'payment_method',
        'notes',
        'wc_order_id',
        'shipping_amount',
    ];

    protected $casts = [
        'courier_party_id' => 'integer',
        'wc_order_id' => 'integer',
        'shipping_amount' => 'decimal:2',
        'type' => InvoiceType::class,
        'payment_method' => PaymentMethod::class,
        'date' => 'date',
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'remaining_amount' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function salesperson(): BelongsTo
    {
        return $this->belongsTo(User::class, 'salesperson_id');
    }

    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }

    public function courierParty(): BelongsTo
    {
        return $this->belongsTo(Party::class, 'courier_party_id');
    }

    public function parentInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'parent_invoice_id');
    }

    public function returnInvoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'parent_invoice_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function treasury(): BelongsTo
    {
        return $this->belongsTo(Treasury::class);
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }

    public function scopeSales(Builder $query): Builder
    {
        return $query->where('type', 'SALE');
    }

    public function scopePurchases(Builder $query): Builder
    {
        return $query->where('type', 'PURCHASE');
    }
}
