<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    use BelongsToStore;
    protected $fillable = [
        'user_id',
        'branch_id',
        'product_id',
        'product_variant_id',
        'product_batch_id',
        'type', // IN, OUT
        'source_type', // PURCHASE, SALE, PURCHASE_RETURN, SALE_RETURN, ADJUSTMENT, INITIAL
        'source_id',
        'quantity',
        'balance_after',
        'unit_price',
        'notes',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'balance_after' => 'decimal:2',
        'unit_price' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(ProductBatch::class, 'product_batch_id');
    }
}
