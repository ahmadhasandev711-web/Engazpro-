<?php

namespace App\Models;

use App\Enums\AnoofyEventResult;
use App\Enums\AnoofyEventType;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnoofyInboxEvent extends Model
{
    use HasFactory, BelongsToStore;

    protected $table = 'anoofy_inbox_events';

    protected $fillable = [
        'user_id',
        'event_id',
        'event_type',
        'order_version',
        'result',
        'reason',
        'received_at',
    ];

    protected $casts = [
        'event_type' => AnoofyEventType::class,
        'result' => AnoofyEventResult::class,
        'order_version' => 'integer',
        'received_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
