<?php

namespace App\Models\Easyfy;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EasyfyProductImage extends Model
{
    protected $table = 'easyfy_product_images';

    protected $fillable = [
        'product_id', 'variant_id', 'image_path', 'is_primary', 'sort_order',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(EasyfyProduct::class, 'product_id');
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(EasyfyProductVariant::class, 'variant_id');
    }
}
