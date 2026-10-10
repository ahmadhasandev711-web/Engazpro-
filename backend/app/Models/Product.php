<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use SoftDeletes, BelongsToStore;

    protected $fillable = [
        'user_id',
        'category_id',
        'type',
        'has_expiry',
        'has_variants',
        'code',
        'barcode',
        'name',
        'unit',
        'sub_unit',
        'sub_unit_factor',
        'sub_unit_price',
        'purchase_price',
        'regular_price',
        'sale_price',
        'min_sale_price',
        'quantity',
        'min_quantity',
        'notes',
        'wc_product_id',
        'image_url',
    ];

    protected $casts = [
        'wc_product_id' => 'integer',
        'has_expiry' => 'boolean',
        'has_variants' => 'boolean',
        'sub_unit_factor' => 'decimal:2',
        'sub_unit_price' => 'decimal:2',
        'purchase_price' => 'decimal:2',
        'regular_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'min_sale_price' => 'decimal:2',
        'quantity' => 'decimal:2',
        'min_quantity' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
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

    public function isVariable(): bool
    {
        return $this->type === 'VARIABLE' || $this->has_variants;
    }

    public function hasExpiry(): bool
    {
        return $this->type === 'EXPIRY' || $this->has_expiry;
    }

    public function isLowStock(): bool
    {
        if ($this->min_quantity === null) {
            return false;
        }
        return $this->quantity <= $this->min_quantity;
    }
}
