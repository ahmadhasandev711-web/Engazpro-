<?php

namespace App\Models\Easyfy;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EasyfyStoreAddress extends Model
{
    protected $table = 'easyfy_store_addresses';

    protected $fillable = [
        'account_id', 'label', 'recipient_name', 'recipient_phone',
        'shipping_zone_id', 'governorate', 'address_line', 'notes', 'is_default',
    ];

    protected $casts = [
        'is_default' => 'boolean',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(User::class, 'account_id');
    }

    public function shippingZone(): BelongsTo
    {
        return $this->belongsTo(EasyfyShippingZone::class, 'shipping_zone_id');
    }
}
