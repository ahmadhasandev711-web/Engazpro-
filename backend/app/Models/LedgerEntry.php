<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LedgerEntry extends Model
{
    use BelongsToStore;
    protected $fillable = [
        'user_id',
        'party_id',
        'source_type', // INVOICE, PAYMENT, ADJUSTMENT, INITIAL
        'source_id',
        'date',
        'description',
        'debit',
        'credit',
        'balance_after',
    ];

    protected $casts = [
        'date' => 'date',
        'debit' => 'decimal:2',
        'credit' => 'decimal:2',
        'balance_after' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }
}
