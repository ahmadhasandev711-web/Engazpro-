<?php

namespace App\Models;

use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WcOrder extends Model
{
    use HasFactory, BelongsToStore;

    protected $table = 'wc_orders';

    protected $fillable = [
        'user_id',
        'wc_order_id',
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
        'status',
        'call_confirmed_at',
        'call_confirmed_by',
        'anoofy_order_version',
        'anoofy_outbound_version',
        'payment_status',
        'wc_payment_method',
        'shipping_cost',
        'subtotal',
        'discount_total',
        'total',
        'customer_name',
        'customer_phone',
        'customer_email',
        'customer_address',
        'governorate',
        'city',
        'notes',
        'wc_coupon_codes',
        'items_snapshot',
    ];

    protected $casts = [
        'wc_order_id' => 'integer',
        'order_date' => 'datetime',
        'status' => WcOrderStatus::class,
        'call_confirmed_at' => 'datetime',
        'anoofy_order_version' => 'integer',
        'anoofy_outbound_version' => 'integer',
        'payment_status' => WcPaymentStatus::class,
        'shipping_cost' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'discount_total' => 'decimal:2',
        'total' => 'decimal:2',
        'shipped_at' => 'datetime',
        'wc_coupon_codes' => 'array',
        'items_snapshot' => 'array',
    ];

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

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(WcOrderItem::class, 'wc_order_id');
    }
}
