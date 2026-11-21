<?php

namespace App\Models;

use App\Enums\EcommercePlatform;
use App\Enums\OnlineOrderCallStatus;
use App\Enums\OrderCancelReason;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OnlineOrder extends Model
{
    use HasFactory, BelongsToStore;

    protected $table = 'online_orders';

    protected $fillable = [
        'user_id',
        'platform',
        'external_order_id',
        'external_order_number',
        'order_date',
        'party_id',
        'branch_id',
        'mandob_id',
        'shipping_type',
        'courier_party_id',
        'courier_name',
        'tracking_number',
        'shipped_at',
        'invoice_id',
        'is_exchange',
        'exchange_id',
        'status',
        'call_confirmed_at',
        'call_confirmed_by',
        'call_confirmed_by_user_id',
        'call_status',
        'call_attempts_count',
        'last_call_attempt_at',
        'last_call_attempt_by',
        'last_call_attempt_by_user_id',
        'call_scheduled_at',
        'call_notes',
        'payment_status',
        'payment_method_label',
        'shipping_cost',
        'subtotal',
        'discount_total',
        'tax_total',
        'total',
        'customer_name',
        'customer_phone',
        'customer_email',
        'customer_address',
        'governorate',
        'city',
        'notes',
        'cancel_reason',
        'cancel_notes',
        'cancelled_at',
        'cancelled_by_user_id',
        'coupon_codes',
        'discount_breakdown',
        'items_snapshot',
        'platform_meta',
    ];

    protected $casts = [
        'platform' => EcommercePlatform::class,
        'order_date' => 'datetime',
        'status' => WcOrderStatus::class,
        'call_confirmed_at' => 'datetime',
        'call_status' => OnlineOrderCallStatus::class,
        'call_attempts_count' => 'integer',
        'last_call_attempt_at' => 'datetime',
        'call_scheduled_at' => 'datetime',
        'cancel_reason' => OrderCancelReason::class,
        'cancelled_at' => 'datetime',
        'payment_status' => WcPaymentStatus::class,
        'shipping_cost' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'discount_total' => 'decimal:2',
        'tax_total' => 'decimal:2',
        'total' => 'decimal:2',
        'shipped_at' => 'datetime',
        'is_exchange' => 'boolean',
        'coupon_codes' => 'array',
        'discount_breakdown' => 'array',
        'items_snapshot' => 'array',
        'platform_meta' => 'array',
    ];

    public function displayReference(): string
    {
        return $this->external_order_number ?: "#{$this->external_order_id}";
    }

    public function meta(string $key, mixed $default = null): mixed
    {
        return ($this->platform_meta ?? [])[$key] ?? $default;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }

    public function courierParty(): BelongsTo
    {
        return $this->belongsTo(Party::class, 'courier_party_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function mandob(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mandob_id');
    }

    public function callConfirmedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'call_confirmed_by_user_id');
    }

    public function lastCallAttemptByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'last_call_attempt_by_user_id');
    }

    public function cancelledByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by_user_id');
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function exchange(): BelongsTo
    {
        return $this->belongsTo(Exchange::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OnlineOrderItem::class, 'online_order_id');
    }
}
