<?php

namespace App\Models;

use App\Enums\ExchangeItemDirection;
use App\Enums\ReturnItemCondition;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExchangeItem extends Model
{
    use BelongsToStore;

    protected $fillable = [
        'user_id',
        'exchange_id',
        'direction',
        'product_id',
        'product_variant_id',
        'product_batch_id',
        'product_name',
        'variant_name',
        'quantity',
        'unit_price',
        'total',
        'condition',
        'received_into_stock_at',
    ];

    protected $casts = [
        'direction' => ExchangeItemDirection::class,
        'quantity' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'total' => 'decimal:2',
        'condition' => ReturnItemCondition::class,
        'received_into_stock_at' => 'datetime',
    ];

    public function exchange(): BelongsTo
    {
        return $this->belongsTo(Exchange::class);
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
