<?php

namespace App\Http\Resources\Easyfy;

use App\Services\Easyfy\EasyfyMediaService;
use App\Services\Easyfy\EasyfyPricingService;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EasyfyCartResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $pricing = app(EasyfyPricingService::class);
        $items = $this->items->map(fn ($item) => $this->mapItem($item, $pricing))->values();
        $subtotal = $this->sumItemTotals($items);

        return [
            'id' => $this->id,
            'coupon_code' => $this->coupon_code,
            'items_count' => $this->items->sum('quantity'),
            'subtotal' => $subtotal->getAmount(),
            'items' => $items,
        ];
    }

    private function mapItem($item, EasyfyPricingService $pricing): array
    {
        $unitPrice = $item->variant ? $pricing->resolveVariantUnitPrice($item->variant, $item->quantity) : Money::zero();
        $lineTotal = $unitPrice->multiply($item->quantity);

        return [
            'id' => $item->id, 'product_id' => $item->product_id, 'variant_id' => $item->variant_id,
            'product_name' => $item->product?->name, 'product_slug' => $item->product?->slug,
            'stock_mode' => $item->product?->stock_mode?->value, 'variant_label' => $item->variant?->label,
            'sku' => $item->variant?->sku, 'image_path' => EasyfyMediaService::toPublicUrl($item->product?->images->first()?->image_path),
            'quantity' => (int) $item->quantity,
            'min_order_qty' => (int) max($item->variant?->min_order_qty ?? 1, $item->product?->min_order_qty ?? 1),
            'allow_custom_note' => (bool) ($item->product?->allow_custom_note ?? false),
            'allow_artwork_upload' => (bool) ($item->product?->allow_artwork_upload ?? false),
            'unit_price' => $unitPrice->getAmount(), 'line_total' => $lineTotal->getAmount(),
            'custom_note' => $item->custom_note, 'has_artwork' => !empty($item->artwork_path),
        ];
    }

    private function sumItemTotals($items): Money
    {
        $sum = Money::zero();
        foreach ($items as $row) {
            $sum = $sum->add(Money::of($row['line_total']));
        }

        return $sum;
    }
}
