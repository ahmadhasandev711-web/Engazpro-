<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollPayout extends Model
{
    use BelongsToStore;

    protected $fillable = [
        'user_id',
        'employee_id',
        'month',
        'base_salary',
        'commission_amount',
        'total_bonuses',
        'total_deductions',
        'net_paid',
        'payment_method',
        'treasury_id',
        'expense_id',
        'notes',
        'paid_by',
        'paid_at',
    ];

    protected $casts = [
        'base_salary' => 'decimal:2',
        'commission_amount' => 'decimal:2',
        'total_bonuses' => 'decimal:2',
        'total_deductions' => 'decimal:2',
        'net_paid' => 'decimal:2',
        'payment_method' => PaymentMethod::class,
        'paid_at' => 'datetime',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function treasury(): BelongsTo
    {
        return $this->belongsTo(Treasury::class);
    }

    public function expense(): BelongsTo
    {
        return $this->belongsTo(Expense::class);
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }
}
