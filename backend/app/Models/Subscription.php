<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Subscription extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'start_date',
        'end_date',
        'status',
        'plan',
        'price',
        'notes',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'price' => 'decimal:2',
    ];

    protected $appends = [
        'days_remaining',
        'is_valid',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        if ($this->status !== 'ACTIVE') {
            return false;
        }

        if (!$this->end_date) {
            return false;
        }

        $endDate = $this->end_date instanceof Carbon ? $this->end_date : Carbon::parse($this->end_date);
        $graceEndDate = $endDate->copy()->addDays(3);
        return Carbon::today()->lte($graceEndDate);
    }

    public function getIsValidAttribute(): bool
    {
        return $this->isActive();
    }

    public function getDaysRemainingAttribute(): int
    {
        if (!$this->end_date) {
            return 0;
        }
        $endDate = $this->end_date instanceof Carbon ? $this->end_date : Carbon::parse($this->end_date);
        $diff = Carbon::today()->diffInDays($endDate, false);
        return max(0, (int) ceil($diff));
    }
}
