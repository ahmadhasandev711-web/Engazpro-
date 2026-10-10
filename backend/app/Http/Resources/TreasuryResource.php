<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TreasuryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type,
            'type_label' => $this->type?->label() ?? $this->type,
            'balance' => (float) $this->balance,
            'current_balance' => (float) $this->balance,
            'assigned_user_id' => $this->assigned_user_id,
            'assigned_user_name' => $this->assignedUser?->name,
            'employee' => $this->assignedUser ? [
                'id' => $this->assignedUser->id,
                'name' => $this->assignedUser->name,
            ] : null,
            'branch_id' => $this->branch_id,
            'branch_name' => $this->branch?->name,
            'branch' => $this->branch ? [
                'id' => $this->branch->id,
                'name' => $this->branch->name,
            ] : null,
            'is_active' => (bool) $this->is_active,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
