<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Expense extends Model
{
    use SoftDeletes, BelongsToStore;

    protected $fillable = [
        'user_id',
        'created_by',
        'treasury_id',
        'shift_id',
        'title',
        'category',
        'amount',
        'payment_method',
        'date',
        'notes',
    ];

    protected $casts = [
        'date' => 'date',
        'amount' => 'decimal:2',
        'payment_method' => \App\Enums\PaymentMethod::class,
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function treasury(): BelongsTo
    {
        return $this->belongsTo(Treasury::class);
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }
}
