<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivationCode extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'duration_days',
        'plan',
        'is_used',
        'is_revoked',
        'used_by_user_id',
        'used_at',
        'revoked_at',
        'batch_reference',
        'notes',
    ];

    protected $casts = [
        'is_used' => 'boolean',
        'is_revoked' => 'boolean',
        'used_at' => 'datetime',
        'revoked_at' => 'datetime',
        'duration_days' => 'integer',
    ];

    public function usedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'used_by_user_id');
    }

    public function usedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'used_by_user_id');
    }
}
