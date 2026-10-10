<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Enums\PaymentType;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Payment extends Model
{
    use SoftDeletes, BelongsToStore;

    protected $fillable = [
        'user_id',
        'idempotency_key',
        'created_by',
        'treasury_id',
        'shift_id',
        'party_id',
        'invoice_id',
        'type', // PAYMENT (دفع لمورد), RECEIPT (قبض من عميل)
        'amount',
        'method', // CASH, CARD, TRANSFER
        'date',
        'notes',
    ];

    protected $casts = [
        'type' => PaymentType::class,
        'method' => PaymentMethod::class,
        'date' => 'date',
        'amount' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function treasury(): BelongsTo
    {
        return $this->belongsTo(Treasury::class);
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }

    public function isReceipt(): bool
    {
        return $this->type === PaymentType::RECEIPT || $this->type?->value === 'RECEIPT';
    }

    public function isPayment(): bool
    {
        return $this->type === PaymentType::PAYMENT || $this->type?->value === 'PAYMENT';
    }
}
