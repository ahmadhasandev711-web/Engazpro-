<?php

namespace App\Models\Easyfy;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EasyfyCartItem extends Model
{
    protected $table = 'easyfy_cart_items';

    protected $fillable = [
        'cart_id', 'product_id', 'variant_id', 'quantity', 'custom_note', 'artwork_path',
    ];

    protected $casts = [
        'quantity' => 'integer',
    ];

    public function cart(): BelongsTo
    {
        return $this->belongsTo(EasyfyCart::class, 'cart_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(EasyfyProduct::class, 'product_id');
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(EasyfyProductVariant::class, 'variant_id');
    }
}
