<?php

namespace App\Models;

use App\Enums\AnoofyEventType;
use App\Enums\AnoofyOutboxStatus;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnoofyOutboxEvent extends Model
{
    use HasFactory, BelongsToStore;

    protected $table = 'anoofy_outbox_events';

    protected $fillable = [
        'user_id',
        'event_id',
        'event_type',
        'wc_order_id',
        'order_version',
        'payload',
        'status',
        'attempts',
        'last_error',
        'sent_at',
    ];

    protected $casts = [
        'event_type' => AnoofyEventType::class,
        'status' => AnoofyOutboxStatus::class,
        'order_version' => 'integer',
        'attempts' => 'integer',
        'payload' => 'array',
        'sent_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function wcOrder(): BelongsTo
    {
        return $this->belongsTo(WcOrder::class, 'wc_order_id');
    }
}
