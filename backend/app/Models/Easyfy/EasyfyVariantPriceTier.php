<?php

namespace App\Models\Easyfy;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EasyfyVariantPriceTier extends Model
{
    protected $table = 'easyfy_variant_price_tiers';

    protected $fillable = [
        'variant_id', 'min_qty', 'unit_price',
    ];

    protected $casts = [
        'min_qty' => 'integer',
        'unit_price' => 'decimal:2',
    ];

    public function variant(): BelongsTo
    {
        return $this->belongsTo(EasyfyProductVariant::class, 'variant_id');
    }
}
