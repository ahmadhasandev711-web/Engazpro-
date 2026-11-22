<?php

namespace App\Http\Requests\Easyfy\Admin;

use App\Enums\Easyfy\EasyfyStockMode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class SaveEasyfyProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return array_merge([
            'category_id' => ['nullable', 'integer', 'exists:easyfy_categories,id'],
            'name' => ['required', 'string', 'max:200'],
            'slug' => ['nullable', 'string', 'max:200'],
            'short_description' => ['nullable', 'string', 'max:300'],
            'description' => ['nullable', 'string', 'max:5000'],
            'stock_mode' => ['required', 'string', new Enum(EasyfyStockMode::class)],
            'lead_time_days' => ['nullable', 'integer', 'min:1', 'max:120'],
            'min_order_qty' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'allow_custom_note' => ['nullable', 'boolean'],
            'custom_note_label' => ['nullable', 'string', 'max:200'],
            'allow_artwork_upload' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'is_featured' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ], $this->variantRules());
    }

    private function variantRules(): array
    {
        return [
            'variants' => ['required', 'array', 'min:1'],
            'variants.*.id' => ['nullable', 'integer', 'exists:easyfy_product_variants,id'],
            'variants.*.sku' => ['nullable', 'string', 'max:80'],
            'variants.*.label' => ['required', 'string', 'max:180'],
            'variants.*.attributes' => ['nullable', 'array'],
            'variants.*.cost_price' => ['nullable', 'numeric', 'min:0'],
            'variants.*.selling_price' => ['required', 'numeric', 'min:0'],
            'variants.*.compare_at_price' => ['nullable', 'numeric', 'min:0'],
            'variants.*.stock_quantity' => ['nullable', 'integer', 'min:0'],
            'variants.*.low_stock_threshold' => ['nullable', 'integer', 'min:0'],
            'variants.*.min_order_qty' => ['nullable', 'integer', 'min:1'],
            'variants.*.is_active' => ['nullable', 'boolean'],
            'variants.*.price_tiers' => ['nullable', 'array'],
            'variants.*.price_tiers.*.min_qty' => ['required_with:variants.*.price_tiers', 'integer', 'min:2'],
            'variants.*.price_tiers.*.unit_price' => ['required_with:variants.*.price_tiers', 'numeric', 'min:0'],
        ];
    }
}
