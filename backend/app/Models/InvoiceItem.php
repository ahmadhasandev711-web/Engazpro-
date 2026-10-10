<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceItem extends Model
{
    protected $fillable = [
        'invoice_id',
        'product_id',
        'product_variant_id',
        'product_batch_id',
        'product_name',
        'product_code',
        'variant_name',
        'batch_number',
        'expiry_date',
        'unit_name',
        'quantity',
        'unit_price',
        'purchase_price_at_sale',
        'total',
        'notes',
    ];

    protected $casts = [
        'expiry_date' => 'date',
        'quantity' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'purchase_price_at_sale' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
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
