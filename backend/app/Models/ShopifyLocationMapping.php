<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShopifyLocationMapping extends Model
{
    use BelongsToStore;

    protected $table = 'shopify_location_mappings';

    protected $fillable = [
        'user_id',
        'shopify_integration_id',
        'shopify_location_id',
        'shopify_location_name',
        'branch_id',
        'auto_sync_stock',
        'is_active',
    ];

    protected $casts = [
        'shopify_location_id' => 'integer',
        'auto_sync_stock' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function integration(): BelongsTo
    {
        return $this->belongsTo(ShopifyIntegration::class, 'shopify_integration_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
