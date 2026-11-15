<?php

namespace App\Models;

use App\Enums\AdminAuditAction;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminAuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'actor_user_id',
        'target_user_id',
        'action',
        'target_type',
        'target_id',
        'summary',
        'metadata',
        'ip_address',
        'user_agent',
        'created_at',
    ];

    protected $casts = [
        'action' => AdminAuditAction::class,
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (AdminAuditLog $log): void {
            if (!$log->created_at) {
                $log->created_at = now();
            }
        });

        static::updating(function (): void {
            throw new \LogicException('سجل التدقيق السيادي للقراءة والإضافة فقط ولا يمكن تعديله.');
        });

        static::deleting(function (): void {
            throw new \LogicException('سجل التدقيق السيادي للقراءة والإضافة فقط ولا يمكن حذفه.');
        });
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function targetUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }
}
