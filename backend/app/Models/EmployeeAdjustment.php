<?php

namespace App\Models;

use App\Enums\EmployeeAdjustmentType;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeAdjustment extends Model
{
    use BelongsToStore;

    protected $fillable = [
        'user_id',
        'employee_id',
        'type',
        'amount',
        'date',
        'reason',
        'created_by',
    ];

    protected $casts = [
        'type' => EmployeeAdjustmentType::class,
        'amount' => 'decimal:2',
        'date' => 'date',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
