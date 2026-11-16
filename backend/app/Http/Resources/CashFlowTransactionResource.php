<?php

namespace App\Http\Resources;

use App\Enums\InvoiceType;
use App\Enums\PaymentType;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CashFlowTransactionResource extends JsonResource
{
    public static function getCategoryLabel(string $category): string
    {
        return match ($category) {
            InvoiceType::SALE->value => 'مبيعات محصلة',
            'SPLIT_SALE' => 'دفعة مبيعات مجزأة',
            'RECEIPT_VOUCHER' => 'سند قبض',
            InvoiceType::PURCHASE_RETURN->value => 'مرتجع شراء مسترد',
            InvoiceType::PURCHASE->value => 'مشتريات مدفوعة',
            'PAYMENT_VOUCHER' => 'سند صرف',
            InvoiceType::SALE_RETURN->value => 'مرتجع بيع مردود',
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
            'reference_number' => $this->source_type === PaymentType::PAYMENT->value ? ('سند #' . $this->reference_number) : (string) ($this->reference_number ?? ('#' . $this->id)),
            'date' => $this->date ? substr((string) $this->date, 0, 10) : null,
            'created_at' => $this->created_at ? (string) $this->created_at : null,
            'amount' => Money::of($this->amount ?? 0)->getAmount(),
            'flow_direction' => $this->flow_direction, // 'IN' or 'OUT'
            'party_id' => $this->party_id ? (int) $this->party_id : null,
            'party_name' => $this->party_name,
            'created_by' => $this->created_by ? (int) $this->created_by : null,
            'creator_name' => $this->creator_name,
            'notes' => $this->notes,
        ];
    }
}
