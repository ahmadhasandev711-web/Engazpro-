<?php

namespace App\Models\Easyfy;

use App\Enums\Easyfy\EasyfyStockMovementType;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EasyfyStockMovement extends Model
{
    public $timestamps = false;

    protected $table = 'easyfy_stock_movements';

    protected $fillable = [
        'variant_id', 'type', 'quantity_delta', 'balance_after',
        'unit_cost', 'reference_order_id', 'created_by', 'notes', 'created_at',
    ];

    protected $casts = [
        'type' => EasyfyStockMovementType::class,
        'quantity_delta' => 'integer',
        'balance_after' => 'integer',
        'unit_cost' => 'decimal:2',
        'created_at' => 'datetime',
    ];

    public function variant(): BelongsTo
    {
        return $this->belongsTo(EasyfyProductVariant::class, 'variant_id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(EasyfyOrder::class, 'reference_order_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
