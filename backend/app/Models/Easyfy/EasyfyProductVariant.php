<?php

namespace App\Models\Easyfy;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EasyfyProductVariant extends Model
{
    protected $table = 'easyfy_product_variants';

    protected $fillable = [
        'product_id', 'sku', 'label', 'attributes', 'cost_price', 'selling_price',
        'compare_at_price', 'stock_quantity', 'low_stock_threshold', 'min_order_qty',
        'is_active', 'sort_order',
    ];

    protected $casts = [
        'attributes' => 'array',
        'cost_price' => 'decimal:2',
        'selling_price' => 'decimal:2',
        'compare_at_price' => 'decimal:2',
        'stock_quantity' => 'integer',
        'low_stock_threshold' => 'integer',
        'min_order_qty' => 'integer',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(EasyfyProduct::class, 'product_id');
    }

    public function priceTiers(): HasMany
    {
        return $this->hasMany(EasyfyVariantPriceTier::class, 'variant_id')->orderBy('min_qty');
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(EasyfyStockMovement::class, 'variant_id')->orderByDesc('id');
    }
}
