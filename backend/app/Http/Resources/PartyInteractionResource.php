<?php

namespace App\Http\Resources;

use App\Enums\CustomerInteractionChannel;
use App\Models\PartyInteraction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PartyInteractionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var PartyInteraction $interaction */
        $interaction = $this->resource;
        $channel = $interaction->channel instanceof CustomerInteractionChannel
            ? $interaction->channel
            : CustomerInteractionChannel::tryFrom((string) $interaction->channel);

        return [
            'id' => $interaction->id,
            'party_id' => $interaction->party_id,
            'created_by' => $interaction->created_by,
            'creator_name' => $interaction->relationLoaded('creator') ? $interaction->creator?->name : null,
            'channel' => $channel?->value ?? (string) $interaction->channel,
            'channel_label' => $channel?->label() ?? (string) $interaction->channel,
            'notes' => $interaction->notes,
            'follow_up_at' => $interaction->follow_up_at?->toIso8601String(),
            'created_at' => $interaction->created_at?->toIso8601String(),
        ];
    }
}
