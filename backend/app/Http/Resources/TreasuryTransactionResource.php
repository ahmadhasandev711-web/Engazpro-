<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TreasuryTransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'type_label' => $this->type?->label() ?? $this->type,
            'amount' => (float) $this->amount,
            'balance_before' => (float) $this->balance_before,
            'balance_after' => (float) $this->balance_after,
            'source_type' => $this->source_type,
            'source_id' => $this->source_id,
            'treasury_id' => $this->treasury_id,
            'treasury_name' => $this->treasury?->name,
            'target_treasury_id' => $this->target_treasury_id,
            'target_treasury_name' => $this->targetTreasury?->name,
            'shift_id' => $this->shift_id,
            'created_by' => $this->created_by,
            'created_by_name' => $this->creator?->name,
            'date' => $this->date ? $this->date->format('Y-m-d') : null,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
