<?php

namespace App\Models;

use App\Enums\BatchExpiryStatus;
use App\Models\Concerns\BelongsToStore;
use App\Support\Money;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductBatch extends Model
{
    use SoftDeletes, BelongsToStore;

    protected $fillable = [
        'product_id',
        'product_variant_id',
        'user_id',
        'batch_number',
        'expiry_date',
        'production_date',
        'quantity',
        'purchase_price',
        'sale_price',
        'notes',
    ];

    protected $casts = [
        'expiry_date' => 'date',
        'production_date' => 'date',
        'quantity' => 'decimal:2',
        'purchase_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function invoiceItems(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function isExpired(): bool
    {
        if (!$this->expiry_date) {
            return false;
        }
        return $this->expiry_date->isPast() && !$this->expiry_date->isToday();
    }

    public function isNearExpiry(int $days = 60): bool
    {
        if (!$this->expiry_date || $this->isExpired()) {
            return false;
        }
        return $this->expiry_date->lessThanOrEqualTo(now()->addDays($days));
    }

    public function getExpiryStatusAttribute(): string
    {
        if ($this->isExpired()) {
            return BatchExpiryStatus::EXPIRED->value;
        }
        if ($this->isNearExpiry()) {
            return BatchExpiryStatus::NEAR_EXPIRY->value;
        }
        return BatchExpiryStatus::VALID->value;
    }

    public function getEffectiveSalePrice(): float
    {
        if ($this->sale_price !== null) {
            return Money::of($this->sale_price)->getAmount();
        }
        if ($this->variant) {
            return $this->variant->getEffectiveSalePrice();
        }
        return Money::of($this->product?->sale_price ?? 0)->getAmount();
    }

    public function getEffectivePurchasePrice(): ?float
    {
        if ($this->purchase_price !== null) {
            return Money::of($this->purchase_price)->getAmount();
        }
        if ($this->variant) {
            return $this->variant->getEffectivePurchasePrice();
        }
        return $this->product?->purchase_price !== null ? Money::of($this->product->purchase_price)->getAmount() : null;
    }
}
