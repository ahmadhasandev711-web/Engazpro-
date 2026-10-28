<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CashFlowTransactionResource extends JsonResource
{
    public static function getCategoryLabel(string $category): string
    {
        return match ($category) {
            'SALE' => 'مبيعات محصلة',
            'SPLIT_SALE' => 'دفعة مبيعات مجزأة',
            'RECEIPT_VOUCHER' => 'سند قبض',
            'PURCHASE_RETURN' => 'مرتجع شراء مسترد',
            'PURCHASE' => 'مشتريات مدفوعة',
            'PAYMENT_VOUCHER' => 'سند صرف',
            'SALE_RETURN' => 'مرتجع بيع مردود',
            'EXPENSE' => 'مصروفات',
            default => $category,
        };
    }

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'source_type' => $this->source_type,
            'movement_category' => $this->movement_category,
            'category_label' => self::getCategoryLabel($this->movement_category ?? ''),
            'reference_number' => $this->source_type === 'PAYMENT' ? ('سند #' . $this->reference_number) : (string) ($this->reference_number ?? ('#' . $this->id)),
            'date' => $this->date ? substr((string) $this->date, 0, 10) : null,
            'created_at' => $this->created_at ? (string) $this->created_at : null,
            'amount' => (float) $this->amount,
            'flow_direction' => $this->flow_direction, // 'IN' or 'OUT'
            'party_id' => $this->party_id ? (int) $this->party_id : null,
            'party_name' => $this->party_name,
            'created_by' => $this->created_by ? (int) $this->created_by : null,
            'creator_name' => $this->creator_name,
            'notes' => $this->notes,
        ];
    }
}
