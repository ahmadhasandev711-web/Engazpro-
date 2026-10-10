<?php

namespace App\Models;

use App\Enums\StockTransferStatus;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockTransfer extends Model
{
    use HasFactory, BelongsToStore;

    protected $fillable = [
        'user_id',
        'transfer_number',
        'from_branch_id',
        'to_branch_id',
        'status',
        'created_by',
        'received_by',
        'transferred_at',
        'received_at',
        'notes',
    ];

    protected $casts = [
        'status' => StockTransferStatus::class,
        'transferred_at' => 'datetime',
        'received_at' => 'datetime',
    ];

    public function fromBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'from_branch_id');
    }

    public function toBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'to_branch_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(StockTransferItem::class);
    }
}
