<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShiftResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'shift_number' => $this->shift_number,
            'status' => $this->status,
            'status_label' => $this->status?->label() ?? $this->status,
            'opened_at' => $this->opened_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'settled_at' => $this->settled_at?->toIso8601String(),
            'created_by' => $this->created_by,
            'created_by_name' => $this->creator?->name,
            'created_by_role' => $this->creator?->role,
            'user' => $this->creator ? [
                'id' => $this->creator->id,
                'name' => $this->creator->name,
                'role' => $this->creator->role,
            ] : null,
            'treasury_id' => $this->treasury_id,
            'treasury_name' => $this->treasury?->name,
            'settled_by' => $this->settled_by,
            'settled_by_name' => $this->settledByUser?->name,
            'settled_by_user' => $this->settledByUser ? [
                'id' => $this->settledByUser->id,
                'name' => $this->settledByUser->name,
            ] : null,
            'opening_balance' => (float) $this->opening_balance,
            'cash_sales' => (float) $this->cash_sales,
            'electronic_sales' => (float) $this->electronic_sales,
            'credit_sales' => (float) $this->credit_sales,
            'cash_receipts' => (float) $this->cash_receipts,
            'cash_returns' => (float) $this->cash_returns,
            'expenses' => (float) $this->expenses,
            'expected_cash' => (float) $this->expected_cash,
            'actual_cash' => $this->actual_cash !== null ? (float) $this->actual_cash : null,
            'difference' => $this->difference !== null ? (float) $this->difference : null,
            'notes' => $this->notes,
            'settlement_notes' => $this->settlement_notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
