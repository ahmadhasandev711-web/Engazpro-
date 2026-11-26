<?php

namespace App\Models;

use App\Enums\EasyOrdersAuthMode;
use App\Models\Concerns\BelongsToStore;
use App\Services\EasyOrders\EasyOrdersStockSyncGate;
use App\Services\EcommerceAccessService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EasyOrdersIntegration extends Model
{
    use HasFactory, BelongsToStore;

    protected static function booted(): void
    {
        $flush = static function (self $integration): void {
            EcommerceAccessService::clearPlatformCache((int) $integration->user_id);
            EasyOrdersStockSyncGate::forget((int) $integration->user_id);
        };
        static::saved($flush);
        static::deleted($flush);
    }

    protected $table = 'easyorders_integrations';

    protected $fillable = [
        'user_id',
        'store_id',
        'store_name',
        'auth_mode',
        'api_key',
        'webhook_secret',
        'default_branch_id',
        'auto_sync_stock',
        'is_active',
        'webhook_registered_at',
        'last_synced_at',
        'last_error',
    ];

    protected $casts = [
        'auth_mode' => EasyOrdersAuthMode::class,
        'api_key' => 'encrypted',
        'webhook_secret' => 'encrypted',
        'auto_sync_stock' => 'boolean',
        'is_active' => 'boolean',
        'webhook_registered_at' => 'datetime',
        'last_synced_at' => 'datetime',
    ];

    protected $hidden = [
        'api_key',
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
}
