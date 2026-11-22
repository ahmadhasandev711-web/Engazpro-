<?php

namespace App\Models\Easyfy;

use App\Enums\Easyfy\EasyfyOrderStatus;
use App\Enums\Easyfy\EasyfyPaymentMethod;
use App\Enums\Easyfy\EasyfyPaymentStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EasyfyOrder extends Model
{
    protected $table = 'easyfy_orders';

    protected $fillable = [
        'order_number', 'idempotency_key', 'account_id', 'store_code', 'store_name',
        'owner_name', 'owner_phone', 'ordered_by_user_id', 'ordered_by_name',
        'ordered_by_phone', 'ordered_by_role', 'shipping_zone_id', 'recipient_name',
        'recipient_phone', 'governorate', 'shipping_address', 'customer_notes',
        'courier_name', 'tracking_number', 'subtotal', 'discount_amount', 'coupon_id',
        'coupon_code', 'shipping_fee', 'total_amount', 'total_cost', 'gross_profit',
        'payment_method', 'payment_verification_status', 'transfer_reference',
        'payment_proof_path', 'verified_by', 'verified_at', 'payment_rejection_reason',
        'status', 'admin_notes', 'confirmed_at', 'shipped_at', 'delivered_at', 'cancelled_at',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'shipping_fee' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'gross_profit' => 'decimal:2',
        'payment_method' => EasyfyPaymentMethod::class,
        'payment_verification_status' => EasyfyPaymentStatus::class,
        'status' => EasyfyOrderStatus::class,
        'verified_at' => 'datetime',
        'confirmed_at' => 'datetime',
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(User::class, 'account_id');
    }

    public function orderedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ordered_by_user_id');
    }

    public function shippingZone(): BelongsTo
    {
        return $this->belongsTo(EasyfyShippingZone::class, 'shipping_zone_id');
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(EasyfyCoupon::class, 'coupon_id');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(EasyfyOrderItem::class, 'order_id')->orderBy('id');
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(EasyfyOrderStatusHistory::class, 'order_id')->orderBy('id');
    }
}
