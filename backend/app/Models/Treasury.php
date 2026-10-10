<?php

namespace App\Models;

use App\Enums\TreasuryType;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Treasury extends Model
{
    use HasFactory, BelongsToStore;

    protected $fillable = [
        'user_id',
        'branch_id',
        'name',
        'type',
        'balance',
        'assigned_user_id',
        'is_active',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'type' => TreasuryType::class,
            'balance' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function shifts(): HasMany
    {
        return $this->hasMany(Shift::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(TreasuryTransaction::class);
    }
}
