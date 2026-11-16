<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShopifyOrderItem extends Model
{
    use BelongsToStore;

    protected $table = 'shopify_order_items';

    protected $fillable = [
        'user_id',
        'shopify_order_id',
        'product_id',
        'product_variant_id',
        'shopify_product_id',
        'shopify_variant_id',
        'quantity',
    ];

    protected $casts = [
        'shopify_product_id' => 'integer',
        'shopify_variant_id' => 'integer',
        'quantity' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(ShopifyOrder::class, 'shopify_order_id');
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
