<?php

namespace App\Models;

use App\Enums\StoreCreditTransactionType;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StoreCreditTransaction extends Model
{
    use BelongsToStore;

    protected $fillable = [
        'user_id',
        'party_id',
        'created_by',
        'type',
        'amount',
        'remaining_amount',
        'balance_after',
        'exchange_id',
        'invoice_id',
        'expires_at',
        'notes',
    ];

    protected $casts = [
        'type' => StoreCreditTransactionType::class,
        'amount' => 'decimal:2',
        'remaining_amount' => 'decimal:2',
        'balance_after' => 'decimal:2',
        'expires_at' => 'datetime',
    ];

    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function exchange(): BelongsTo
    {
        return $this->belongsTo(Exchange::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
