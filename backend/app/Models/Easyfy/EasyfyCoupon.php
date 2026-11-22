<?php

namespace App\Models\Easyfy;

use App\Enums\Easyfy\EasyfyCouponType;
use Illuminate\Database\Eloquent\Model;

class EasyfyCoupon extends Model
{
    protected $table = 'easyfy_coupons';

    protected $fillable = [
        'code', 'discount_type', 'discount_value', 'min_order_amount',
        'max_discount_amount', 'max_uses', 'max_uses_per_account',
        'used_count', 'starts_at', 'expires_at', 'is_active',
    ];

    protected $casts = [
        'discount_type' => EasyfyCouponType::class,
        'discount_value' => 'decimal:2',
        'min_order_amount' => 'decimal:2',
        'max_discount_amount' => 'decimal:2',
        'max_uses' => 'integer',
        'max_uses_per_account' => 'integer',
        'used_count' => 'integer',
        'starts_at' => 'datetime',
        'expires_at' => 'datetime',
        'is_active' => 'boolean',
    ];
}
