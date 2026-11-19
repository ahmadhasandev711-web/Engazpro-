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
        'promotion_id',
        'coupon_code',
        'date',
        'subtotal',
        'discount',
        'promotion_discount',
        'tax',
        'total',
        'paid_amount',
        'remaining_amount',
        'payment_method',
        'notes',
        'wc_order_id',
        'shopify_order_id',
        'online_order_id',
        'shipping_amount',
    ];

    protected $casts = [
        'courier_party_id' => 'integer',
        'wc_order_id' => 'integer',
        'shopify_order_id' => 'integer',
        'online_order_id' => 'integer',
        'shipping_amount' => 'decimal:2',
        'promotion_discount' => 'decimal:2',
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

    public function onlineOrder(): BelongsTo
    {
        return $this->belongsTo(OnlineOrder::class, 'online_order_id');
    }

    public function parentInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'parent_invoice_id');
    }

    public function returnInvoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'parent_invoice_id');
    }

    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
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
        return $query->where('type', InvoiceType::SALE->value);
    }

    public function scopePurchases(Builder $query): Builder
    {
        return $query->where('type', InvoiceType::PURCHASE->value);
    }

    public function scopeNonEcommerce(Builder $query): Builder
    {
        return $query->whereNull('online_order_id')
            ->whereNull('wc_order_id')
            ->whereNull('shopify_order_id')
            ->whereDoesntHave('parentInvoice', function (Builder $p): void {
                $p->whereNotNull('online_order_id')
                    ->orWhereNotNull('wc_order_id')
                    ->orWhereNotNull('shopify_order_id');
            });
    }

    public function isEcommerceOrder(): bool
    {
        if ($this->online_order_id !== null || $this->wc_order_id !== null || $this->shopify_order_id !== null) {
            return true;
        }

        return $this->parent_invoice_id !== null && (bool) $this->parentInvoice?->isEcommerceOrder();
    }
}
