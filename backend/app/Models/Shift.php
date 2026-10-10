<?php

namespace App\Models;

use App\Enums\ShiftStatus;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shift extends Model
{
    use HasFactory, BelongsToStore;

    protected $fillable = [
        'user_id',
        'created_by',
        'treasury_id',
        'shift_number',
        'status',
        'opened_at',
        'closed_at',
        'settled_at',
        'settled_by',
        'opening_balance',
        'cash_sales',
        'electronic_sales',
        'credit_sales',
        'cash_receipts',
        'cash_returns',
        'expenses',
        'expected_cash',
        'actual_cash',
        'difference',
        'notes',
        'settlement_notes',
    ];

    protected function casts(): array
    {
        return [
            'status' => ShiftStatus::class,
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'settled_at' => 'datetime',
            'opening_balance' => 'decimal:2',
            'cash_sales' => 'decimal:2',
            'electronic_sales' => 'decimal:2',
            'credit_sales' => 'decimal:2',
            'cash_receipts' => 'decimal:2',
            'cash_returns' => 'decimal:2',
            'expenses' => 'decimal:2',
            'expected_cash' => 'decimal:2',
            'actual_cash' => 'decimal:2',
            'difference' => 'decimal:2',
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

    public function settledByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'settled_by');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function expenseRecords(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(TreasuryTransaction::class);
    }
}
