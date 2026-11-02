<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WcOrderItem extends Model
{
    use HasFactory, BelongsToStore;

    protected $table = 'wc_order_items';

    protected $fillable = [
        'user_id',
        'wc_order_id',
        'product_id',
        'product_variant_id',
        'wc_product_id',
        'wc_variation_id',
        'quantity',
    ];

    protected $casts = [
        'wc_product_id' => 'integer',
        'wc_variation_id' => 'integer',
        'quantity' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(WcOrder::class, 'wc_order_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
