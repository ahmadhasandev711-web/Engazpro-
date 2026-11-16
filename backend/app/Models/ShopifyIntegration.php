<?php

namespace App\Models;

use App\Enums\ShopifyAuthMode;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ShopifyIntegration extends Model
{
    use HasFactory, BelongsToStore;

    protected $table = 'shopify_integrations';

    protected $fillable = [
        'user_id',
        'shop_domain',
        'auth_mode',
        'access_token',
        'client_id',
        'client_secret',
        'webhook_secret',
        'default_branch_id',
        'auto_sync_stock',
        'is_active',
        'token_expires_at',
        'last_synced_at',
        'last_error',
    ];

    protected $casts = [
        'auth_mode' => ShopifyAuthMode::class,
        'access_token' => 'encrypted',
        'client_secret' => 'encrypted',
        'webhook_secret' => 'encrypted',
        'auto_sync_stock' => 'boolean',
        'is_active' => 'boolean',
        'token_expires_at' => 'datetime',
        'last_synced_at' => 'datetime',
    ];

    protected $hidden = [
        'access_token',
        'client_secret',
        'webhook_secret',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function defaultBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'default_branch_id');
    }

    public function locationMappings(): HasMany
    {
        return $this->hasMany(ShopifyLocationMapping::class, 'shopify_integration_id');
    }
}
