<?php

namespace App\Models\Easyfy;

use Illuminate\Database\Eloquent\Model;

class EasyfyShippingZone extends Model
{
    protected $table = 'easyfy_shipping_zones';

    protected $fillable = [
        'governorate_name', 'shipping_fee', 'free_shipping_threshold',
        'estimated_days', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'shipping_fee' => 'decimal:2',
        'free_shipping_threshold' => 'decimal:2',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];
}
