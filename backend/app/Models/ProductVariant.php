<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductVariant extends Model
{
    use SoftDeletes, BelongsToStore;

    protected $fillable = [
        'product_id',
        'user_id',
        'name',
        'color',
        'size',
        'barcode',
        'code',
        'purchase_price',
        'regular_price',
        'sale_price',
        'quantity',
        'min_quantity',
        'wc_variation_id',
        'image_url',
    ];

    protected $casts = [
        'wc_variation_id' => 'integer',
        'purchase_price' => 'decimal:2',
        'regular_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'quantity' => 'decimal:2',
        'min_quantity' => 'decimal:2',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function batches(): HasMany
    {
        return $this->hasMany(ProductBatch::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function invoiceItems(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function branchStocks(): HasMany
    {
        return $this->hasMany(BranchStock::class);
    }

    public function isLowStock(): bool
    {
        if ($this->min_quantity === null) {
            return false;
        }
        return $this->quantity <= $this->min_quantity;
    }

    public function getEffectiveSalePrice(): float
    {
        return (float) ($this->sale_price ?? $this->product?->sale_price ?? 0);
    }

    public function getEffectivePurchasePrice(): ?float
    {
        return $this->purchase_price !== null ? (float) $this->purchase_price : ($this->product?->purchase_price !== null ? (float) $this->product->purchase_price : null);
    }
}
