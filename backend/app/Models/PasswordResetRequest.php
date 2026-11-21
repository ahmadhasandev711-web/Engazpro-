<?php

namespace App\Models;

use App\Enums\PasswordResetRequestStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PasswordResetRequest extends Model
{
    protected $fillable = [
        'user_id',
        'owner_id',
        'phone',
        'requester_role',
        'status',
        'handled_by',
        'handled_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'status' => PasswordResetRequestStatus::class,
            'handled_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }
}
