<?php

namespace App\Models\Easyfy;

use App\Enums\Easyfy\EasyfyStockMode;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EasyfyOrderItem extends Model
{
    protected $table = 'easyfy_order_items';

    protected $fillable = [
        'order_id', 'product_id', 'variant_id', 'product_name', 'variant_label',
        'sku', 'stock_mode', 'unit_price', 'unit_cost', 'quantity',
        'line_total', 'line_cost', 'line_profit', 'custom_note', 'artwork_path',
    ];

    protected $casts = [
        'stock_mode' => EasyfyStockMode::class,
        'unit_price' => 'decimal:2',
        'unit_cost' => 'decimal:2',
        'quantity' => 'integer',
        'line_total' => 'decimal:2',
        'line_cost' => 'decimal:2',
        'line_profit' => 'decimal:2',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(EasyfyOrder::class, 'order_id');
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
