<?php

namespace App\Http\Resources;

use App\Support\Money;
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
            'user' => $this->creator ? ['id' => $this->creator->id, 'name' => $this->creator->name, 'role' => $this->creator->role] : null,
            'treasury_id' => $this->treasury_id,
            'treasury_name' => $this->treasury?->name,
            'settled_by' => $this->settled_by,
            'settled_by_name' => $this->settledByUser?->name,
            'settled_by_user' => $this->settledByUser ? ['id' => $this->settledByUser->id, 'name' => $this->settledByUser->name] : null,
            ...$this->financialAmounts(),
            'notes' => $this->notes,
            'settlement_notes' => $this->settlement_notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    private function financialAmounts(): array
    {
        return [
            'opening_balance' => Money::of($this->opening_balance ?? 0)->getAmount(),
            'cash_sales' => Money::of($this->cash_sales ?? 0)->getAmount(),
            'electronic_sales' => Money::of($this->electronic_sales ?? 0)->getAmount(),
            'credit_sales' => Money::of($this->credit_sales ?? 0)->getAmount(),
            'cash_receipts' => Money::of($this->cash_receipts ?? 0)->getAmount(),
            'cash_returns' => Money::of($this->cash_returns ?? 0)->getAmount(),
            'expenses' => Money::of($this->expenses ?? 0)->getAmount(),
            'expected_cash' => Money::of($this->expected_cash ?? 0)->getAmount(),
            'actual_cash' => $this->actual_cash !== null ? Money::of($this->actual_cash)->getAmount() : null,
            'difference' => $this->difference !== null ? Money::of($this->difference)->getAmount() : null,
        ];
    }
}
