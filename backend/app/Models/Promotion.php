<?php

namespace App\Models;

use App\Enums\PromotionDiscountType;
use App\Enums\PromotionSyncSource;
use App\Enums\PromotionType;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Promotion extends Model
{
    use SoftDeletes, BelongsToStore;

    protected $fillable = [
        'user_id',
        'branch_id',
        'name',
        'code',
        'type',
        'discount_type',
        'discount_value',
        'buy_quantity',
        'get_quantity',
        'category_id',
        'product_id',
        'min_order_amount',
        'max_discount_amount',
        'max_uses',
        'used_count',
        'starts_at',
        'ends_at',
        'is_active',
        'wc_coupon_id',
        'shopify_discount_id',
        'sync_source',
        'sync_to_ecommerce',
        'last_synced_at',
        'sync_error',
    ];

    protected $casts = [
        'type' => PromotionType::class,
        'discount_type' => PromotionDiscountType::class,
        'sync_source' => PromotionSyncSource::class,
        'discount_value' => 'decimal:2',
        'min_order_amount' => 'decimal:2',
        'max_discount_amount' => 'decimal:2',
        'buy_quantity' => 'integer',
        'get_quantity' => 'integer',
        'max_uses' => 'integer',
        'used_count' => 'integer',
        'wc_coupon_id' => 'integer',
        'starts_at' => 'date',
        'ends_at' => 'date',
        'is_active' => 'boolean',
        'sync_to_ecommerce' => 'boolean',
        'last_synced_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
