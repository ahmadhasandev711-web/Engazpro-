<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WooCommerceIntegration extends Model
{
    use HasFactory, BelongsToStore;

    protected $table = 'woocommerce_integrations';

    protected $fillable = [
        'user_id',
        'store_url',
        'consumer_key',
        'consumer_secret',
        'webhook_secret',
        'online_branch_id',
        'auto_sync_stock',
        'is_active',
        'last_synced_at',
        'last_error',
    ];

    protected $casts = [
        'consumer_key' => 'encrypted',
        'consumer_secret' => 'encrypted',
        'auto_sync_stock' => 'boolean',
        'is_active' => 'boolean',
        'last_synced_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function onlineBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'online_branch_id');
    }
}
