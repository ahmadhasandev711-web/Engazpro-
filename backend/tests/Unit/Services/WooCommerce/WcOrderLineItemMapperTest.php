<?php

namespace Tests\Unit\Services\WooCommerce;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\WooCommerce\WcOrderLineItemMapper;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use PHPUnit\Framework\TestCase;

class WcOrderLineItemMapperTest extends TestCase
{
    private WcOrderLineItemMapper $mapper;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mapper = new WcOrderLineItemMapper();
    }

    public function test_enrich_adds_image_and_attributes_without_n_plus_one(): void
    {
        $product = new Product();
        $product->id = 10;
        $product->wc_product_id = 901;
        $product->image_url = 'https://example.com/product.jpg';

        $variant = new ProductVariant();
        $variant->id = 20;
        $variant->wc_variation_id = 9021;
        $variant->image_url = 'https://example.com/variant.jpg';

        $products = new EloquentCollection([901 => $product]);
        $variants = new EloquentCollection([9021 => $variant]);

        $rawItems = [
            [
                'id' => 1,
                'product_id' => 901,
                'name' => '<b>قميص قطني</b>',
                'meta_data' => [
                    ['key' => '_hidden_meta', 'value' => 'secret'],
                    ['display_key' => 'اللون', 'display_value' => 'أزرق'],
                ],
            ],
            [
                'id' => 2,
                'product_id' => 902,
                'variation_id' => 9021,
                'name' => 'بنطلون',
                'meta_data' => [],
            ],
        ];

        $enriched = $this->mapper->enrich(1, $rawItems, $products, $variants);

        $this->assertCount(2, $enriched);
        $this->assertSame('قميص قطني', $enriched[0]['name']);
        $this->assertSame('https://example.com/product.jpg', $enriched[0]['image_url']);
        $this->assertSame([['key' => 'اللون', 'value' => 'أزرق']], $enriched[0]['attributes']);

        $this->assertSame('https://example.com/variant.jpg', $enriched[1]['image_url']);
        $this->assertSame([], $enriched[1]['attributes']);
    }

    public function test_build_item_rows_maps_matched_and_unmatched_items(): void
    {
        $product = new Product();
        $product->id = 10;
        $product->wc_product_id = 901;

        $variant = new ProductVariant();
        $variant->id = 20;
        $variant->wc_variation_id = 9021;

        $products = new EloquentCollection([901 => $product]);
        $variants = new EloquentCollection([9021 => $variant]);

        $rawItems = [
            [
                'product_id' => 901,
                'quantity' => 2,
            ],
            [
                'product_id' => 902,
                'variation_id' => 9021,
                'quantity' => '1.5',
            ],
            [
                'product_id' => 9999,
                'quantity' => 3,
            ],
        ];

        $rows = $this->mapper->buildItemRows(1, 100, $rawItems, $products, $variants);

        $this->assertCount(3, $rows);

        // Item 1: Simple mapped
        $this->assertSame(10, $rows[0]['product_id']);
        $this->assertNull($rows[0]['product_variant_id']);
        $this->assertSame('2.00', $rows[0]['quantity']);

        // Item 2: Variant mapped
        $this->assertNull($rows[1]['product_id']); // Product 902 not in $products collection
        $this->assertSame(20, $rows[1]['product_variant_id']);
        $this->assertSame('1.50', $rows[1]['quantity']);

        // Item 3: Unmatched product
        $this->assertNull($rows[2]['product_id']);
        $this->assertNull($rows[2]['product_variant_id']);
        $this->assertSame('3.00', $rows[2]['quantity']);
    }
}
