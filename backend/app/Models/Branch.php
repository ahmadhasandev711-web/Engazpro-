<?php

namespace App\Models;

use App\Enums\BranchType;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Branch extends Model
{
    use HasFactory, SoftDeletes, BelongsToStore;

    protected $fillable = [
        'user_id',
        'name',
        'code',
        'type',
        'phone',
        'address',
        'is_main',
        'is_active',
    ];

    protected $casts = [
        'type' => BranchType::class,
        'is_main' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function stocks(): HasMany
    {
        return $this->hasMany(BranchStock::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function treasuries(): HasMany
    {
        return $this->hasMany(Treasury::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function transfersSent(): HasMany
    {
        return $this->hasMany(StockTransfer::class, 'from_branch_id');
    }

    public function transfersReceived(): HasMany
    {
        return $this->hasMany(StockTransfer::class, 'to_branch_id');
    }
}
