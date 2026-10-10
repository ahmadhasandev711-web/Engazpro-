<?php

namespace App\Models;

use App\Enums\TreasuryTransactionType;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TreasuryTransaction extends Model
{
    use HasFactory, BelongsToStore;

    protected $fillable = [
        'user_id',
        'created_by',
        'treasury_id',
        'target_treasury_id',
        'shift_id',
        'type',
        'amount',
        'balance_before',
        'balance_after',
        'source_type',
        'source_id',
        'date',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'type' => TreasuryTransactionType::class,
            'amount' => 'decimal:2',
            'balance_before' => 'decimal:2',
            'balance_after' => 'decimal:2',
            'date' => 'date',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function treasury(): BelongsTo
    {
        return $this->belongsTo(Treasury::class);
    }

    public function targetTreasury(): BelongsTo
    {
        return $this->belongsTo(Treasury::class, 'target_treasury_id');
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }
}
