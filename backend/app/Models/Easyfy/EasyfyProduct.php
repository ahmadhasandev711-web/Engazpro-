<?php

namespace App\Models\Easyfy;

use App\Enums\Easyfy\EasyfyStockMode;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class EasyfyProduct extends Model
{
    use SoftDeletes;

    protected $table = 'easyfy_products';

    protected $fillable = [
        'category_id', 'name', 'slug', 'short_description', 'description',
        'stock_mode', 'lead_time_days', 'min_order_qty', 'allow_custom_note',
        'custom_note_label', 'allow_artwork_upload', 'is_active', 'is_featured', 'sort_order',
    ];

    protected $casts = [
        'stock_mode' => EasyfyStockMode::class,
        'lead_time_days' => 'integer',
        'min_order_qty' => 'integer',
        'allow_custom_note' => 'boolean',
        'allow_artwork_upload' => 'boolean',
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(EasyfyCategory::class, 'category_id');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(EasyfyProductVariant::class, 'product_id')->orderBy('sort_order')->orderBy('id');
    }

    public function images(): HasMany
    {
        return $this->hasMany(EasyfyProductImage::class, 'product_id')->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id');
    }
}
