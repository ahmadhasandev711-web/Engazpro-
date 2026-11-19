<?php

namespace App\Models;

use App\Enums\CustomerInteractionChannel;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartyInteraction extends Model
{
    use BelongsToStore;

    protected $table = 'party_interactions';

    protected $fillable = [
        'user_id',
        'party_id',
        'created_by',
        'channel',
        'notes',
        'follow_up_at',
    ];

    protected function casts(): array
    {
        return [
            'channel' => CustomerInteractionChannel::class,
            'follow_up_at' => 'datetime',
        ];
    }

    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
