<?php

namespace Database\Seeders;

use App\Enums\Easyfy\EasyfyCouponType;
use App\Enums\Easyfy\EasyfyStockMode;
use App\Enums\Easyfy\EasyfyStockMovementType;
use App\Models\Easyfy\EasyfyCategory;
use App\Models\Easyfy\EasyfyCoupon;
use App\Models\Easyfy\EasyfyProduct;
use App\Models\Easyfy\EasyfyProductImage;
use App\Models\Easyfy\EasyfyProductVariant;
use App\Models\Easyfy\EasyfyShippingZone;
use App\Models\Easyfy\EasyfyStockMovement;
use App\Models\Easyfy\EasyfyStoreSetting;
use App\Models\Easyfy\EasyfyVariantPriceTier;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class EasyfyStoreDemoSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $imageUrls = $this->publishDemoImages();
            $categoryIds = $this->seedCategories($imageUrls);
            $this->seedProducts($categoryIds, $imageUrls);
            $this->seedShippingZones();
            $this->seedCoupons();
            $this->seedDefaultSettings();
        });
    }

    /**
     * @return array<string, string>
     */
    private function publishDemoImages(): array
    {
        $assetsDir = database_path('seeders/assets/easyfy');
        $files = [
            'shipping-boxes.jpg',
            'mailer-box.jpg',
            'polymailer-bags.jpg',
            'thermal-labels.jpg',
            'bubble-wrap-tape.jpg',
            'padded-envelopes.jpg',
            'packing-tools.jpg',
            'custom-printed-bags.jpg',
        ];

        $urls = [];
        foreach ($files as $file) {
            $source = $assetsDir . DIRECTORY_SEPARATOR . $file;
            $target = 'easyfy/catalog/demo-' . $file;
            if (is_file($source)) {
                Storage::disk('public')->put($target, (string) file_get_contents($source));
            }
            $urls[$file] = '/storage/' . $target;
        }

        return $urls;
    }

    /**
     * @param  array<string, string>  $images
     * @return array<string, int>
     */
    private function seedCategories(array $images): array
    {
        $defs = [
            ['slug' => 'shipping-boxes', 'name' => 'كراتين وبوكسات الشحن', 'description' => 'كراتين 3 و5 طبقات وبوكسات ملابس قفل ذاتي', 'img' => 'shipping-boxes.jpg', 'sort' => 1],
            ['slug' => 'polymailer-bags', 'name' => 'أكياس وأظرف الشحن', 'description' => 'أكياس بوليميلر مضادة للماء وأظرف مبطنة', 'img' => 'polymailer-bags.jpg', 'sort' => 2],
            ['slug' => 'thermal-labels', 'name' => 'رولات وملصقات حرارية', 'description' => 'رولات بوليصات A6 واستيكر باركود وورق كاشير', 'img' => 'thermal-labels.jpg', 'sort' => 3],
            ['slug' => 'bubble-wrap-tape', 'name' => 'بابل راب وتغليف وأدوات', 'description' => 'رولات حماية الفقاعات والاسترتش والشريط اللاصق وأدوات التجهيز', 'img' => 'bubble-wrap-tape.jpg', 'sort' => 4],
            ['slug' => 'custom-printed', 'name' => 'تغليف مطبوع باللوجو حسب الطلب', 'description' => 'شنط وبوكسات وتيب مطبوع باسم وهوية براندك', 'img' => 'custom-printed-bags.jpg', 'sort' => 5],
        ];

        $map = [];
        foreach ($defs as $row) {
            $cat = EasyfyCategory::updateOrCreate(
                ['slug' => $row['slug']],
                [
                    'name' => $row['name'],
                    'description' => $row['description'],
                    'image_path' => $images[$row['img']] ?? null,
                    'sort_order' => $row['sort'],
                    'is_active' => true,
                ]
            );
            $map[$row['slug']] = $cat->id;
        }

        return $map;
    }

    /**
     * @param  array<string, int>  $categoryIds
     * @param  array<string, string>  $images
     */
    private function seedProducts(array $categoryIds, array $images): void
    {
        foreach ($this->catalogDefinitions() as $index => $def) {
            $product = EasyfyProduct::withTrashed()->updateOrCreate(
                ['slug' => $def['slug']],
                [
                    'category_id' => $categoryIds[$def['cat']] ?? null,
                    'name' => $def['name'],
                    'short_description' => $def['short'],
                    'description' => $def['desc'],
                    'stock_mode' => $def['mode'],
                    'lead_time_days' => $def['lead_days'] ?? null,
                    'min_order_qty' => $def['min_qty'] ?? 1,
                    'allow_custom_note' => $def['custom_note'] ?? false,
                    'custom_note_label' => $def['note_label'] ?? null,
                    'allow_artwork_upload' => $def['artwork'] ?? false,
                    'is_active' => true,
                    'is_featured' => $def['featured'] ?? false,
                    'sort_order' => $index + 1,
                    'deleted_at' => null,
                ]
            );

            $imgPath = $images[$def['img']] ?? null;
            if ($imgPath) {
                EasyfyProductImage::updateOrCreate(
                    ['product_id' => $product->id, 'image_path' => $imgPath],
                    ['is_primary' => true, 'sort_order' => 1]
                );
            }

            $this->upsertVariants($product, $def['variants']);
        }
    }

    private function upsertVariants(EasyfyProduct $product, array $variants): void
    {
        foreach ($variants as $v) {
            $variant = EasyfyProductVariant::updateOrCreate(
                ['sku' => $v['sku']],
                [
                    'product_id' => $product->id,
                    'label' => $v['label'],
                    'attributes' => $v['attrs'] ?? [],
                    'cost_price' => $v['cost'],
                    'selling_price' => $v['price'],
                    'compare_at_price' => $v['compare'] ?? null,
                    'stock_quantity' => $v['stock'] ?? 0,
                    'low_stock_threshold' => $v['low'] ?? 5,
                    'min_order_qty' => $v['min_qty'] ?? 1,
                    'is_active' => true,
                ]
            );

            if ($product->stock_mode === EasyfyStockMode::TRACKED && ($v['stock'] ?? 0) > 0 && !$variant->stockMovements()->exists()) {
                EasyfyStockMovement::create([
                    'variant_id' => $variant->id,
                    'type' => EasyfyStockMovementType::OPENING,
                    'quantity_delta' => (int) $v['stock'],
                    'balance_after' => (int) $v['stock'],
                    'unit_cost' => $v['cost'],
                    'notes' => 'رصيد افتتاحي — بيانات تجريبية',
                    'created_at' => now(),
                ]);
            }

            EasyfyVariantPriceTier::where('variant_id', $variant->id)->delete();
            foreach ($v['tiers'] ?? [] as $tier) {
                EasyfyVariantPriceTier::create([
                    'variant_id' => $variant->id,
                    'min_qty' => $tier['min_qty'],
                    'unit_price' => $tier['unit_price'],
                ]);
            }
        }
    }

    private function seedShippingZones(): void
    {
        $zones = [
            ['governorate_name' => 'القاهرة والجيزة', 'shipping_fee' => 55, 'free_shipping_threshold' => 2500, 'estimated_days' => '1-2 أيام', 'sort_order' => 1],
            ['governorate_name' => 'الإسكندرية', 'shipping_fee' => 75, 'free_shipping_threshold' => 2500, 'estimated_days' => '2-3 أيام', 'sort_order' => 2],
            ['governorate_name' => 'الدلتا والمنصورة وطنطا', 'shipping_fee' => 80, 'free_shipping_threshold' => 3000, 'estimated_days' => '2-3 أيام', 'sort_order' => 3],
            ['governorate_name' => 'مدن القناة (بورسعيد / السويس / الإسماعيلية)', 'shipping_fee' => 85, 'free_shipping_threshold' => 3000, 'estimated_days' => '2-4 أيام', 'sort_order' => 4],
            ['governorate_name' => 'محافظات الصعيد', 'shipping_fee' => 95, 'free_shipping_threshold' => 3500, 'estimated_days' => '3-5 أيام', 'sort_order' => 5],
            ['governorate_name' => 'البحر الأحمر والساحل الشمالي', 'shipping_fee' => 110, 'free_shipping_threshold' => 4000, 'estimated_days' => '3-5 أيام', 'sort_order' => 6],
        ];

        foreach ($zones as $z) {
            EasyfyShippingZone::updateOrCreate(
                ['governorate_name' => $z['governorate_name']],
                array_merge($z, ['is_active' => true])
            );
        }
    }

    private function seedCoupons(): void
    {
        $coupons = [
            [
                'code' => 'EASY10',
                'discount_type' => EasyfyCouponType::PERCENTAGE,
                'discount_value' => 10,
                'min_order_amount' => 300,
                'max_discount_amount' => 200,
                'max_uses_per_account' => 5,
                'is_active' => true,
            ],
            [
                'code' => 'SAVE100',
                'discount_type' => EasyfyCouponType::FIXED,
                'discount_value' => 100,
                'min_order_amount' => 800,
                'max_discount_amount' => 100,
                'max_uses_per_account' => 3,
                'is_active' => true,
            ],
            [
                'code' => 'FREESHIP',
                'discount_type' => EasyfyCouponType::FREE_SHIPPING,
                'discount_value' => 0,
                'min_order_amount' => 200,
                'max_discount_amount' => null,
                'max_uses_per_account' => 3,
                'is_active' => true,
            ],
        ];

        foreach ($coupons as $c) {
            EasyfyCoupon::updateOrCreate(['code' => $c['code']], $c);
        }
    }

    private function seedDefaultSettings(): void
    {
        $defaults = [
            'store_enabled' => '1',
            'cod_enabled' => '1',
            'instapay_enabled' => '1',
            'vodafone_cash_enabled' => '1',
            'instapay_handle' => 'easyfy@instapay',
            'instapay_name' => 'Easyfy Supplies',
            'vodafone_cash_number' => '01000000000',
            'default_shipping_fee' => '55',
            'free_shipping_threshold' => '2500',
            'support_whatsapp' => '201125030642',
            'invoice_footer' => 'شكراً لتعاملكم مع متجر Easyfy لمستلزمات التجار.',
        ];

        foreach ($defaults as $key => $value) {
            EasyfyStoreSetting::firstOrCreate(['key' => $key], ['value' => $value]);
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function catalogDefinitions(): array
    {
        return array_merge(
            $this->trackedCatalog(),
            $this->unlimitedCatalog(),
            $this->madeToOrderCatalog()
        );
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function trackedCatalog(): array
    {
        return [
            [
                'slug' => 'box-3ply-standard', 'cat' => 'shipping-boxes', 'img' => 'shipping-boxes.jpg', 'featured' => true,
                'mode' => EasyfyStockMode::TRACKED,
                'name' => 'كراتين شحن كرافت 3 طبقات مقوّاة',
                'short' => 'ربطة 20 كرتونة شحن عالية التحمل للشحن الداخلي وشركات الشحن',
                'desc' => 'كراتين كرافت 3 طبقات متينة تتحمل الضغط والرطوبة أثناء النقل بين المحافظات.',
                'variants' => [
                    ['sku' => 'ESF-BOX-S20', 'label' => 'مقاس صغير 20×15×10 سم (ربطة 20)', 'cost' => 115, 'price' => 165, 'compare' => 190, 'stock' => 45, 'low' => 8, 'tiers' => [['min_qty' => 5, 'unit_price' => 150], ['min_qty' => 15, 'unit_price' => 140]]],
                    ['sku' => 'ESF-BOX-M20', 'label' => 'مقاس وسط 30×20×15 سم (ربطة 20)', 'cost' => 160, 'price' => 230, 'compare' => 260, 'stock' => 38, 'low' => 8, 'tiers' => [['min_qty' => 5, 'unit_price' => 210], ['min_qty' => 15, 'unit_price' => 195]]],
                    ['sku' => 'ESF-BOX-L20', 'label' => 'مقاس كبير 40×30×25 سم (ربطة 20)', 'cost' => 240, 'price' => 330, 'compare' => 370, 'stock' => 22, 'low' => 5, 'tiers' => [['min_qty' => 5, 'unit_price' => 305]]],
                ],
            ],
            [
                'slug' => 'mailer-box-self-lock', 'cat' => 'shipping-boxes', 'img' => 'mailer-box.jpg', 'featured' => true,
                'mode' => EasyfyStockMode::TRACKED,
                'name' => 'بوكس ملابس قفل ذاتي Mailer Box',
                'short' => 'بوكسات براندات فاخرة سريعة التقفيل بدون شريط لاصق (ربطة 25 بوكس)',
                'desc' => 'تصميم أنيق مثالي لبراندات الملابس والهدايا والعطور مع قفل جانبي محكم.',
                'variants' => [
                    ['sku' => 'ESF-MLR-BLK', 'label' => 'أسود مطفي 32×24×10 سم (25 بوكس)', 'cost' => 260, 'price' => 375, 'compare' => 420, 'stock' => 30, 'low' => 6, 'tiers' => [['min_qty' => 4, 'unit_price' => 350], ['min_qty' => 10, 'unit_price' => 330]]],
                    ['sku' => 'ESF-MLR-KRF', 'label' => 'كرافت طبيعي 35×25×12 سم (25 بوكس)', 'cost' => 210, 'price' => 310, 'compare' => 345, 'stock' => 40, 'low' => 8, 'tiers' => [['min_qty' => 4, 'unit_price' => 285]]],
                ],
            ],
            [
                'slug' => 'shoe-box-corrugated', 'cat' => 'shipping-boxes', 'img' => 'mailer-box.jpg',
                'mode' => EasyfyStockMode::TRACKED,
                'name' => 'كرتونة شحن أحذية وسنيكرز مقوّاة',
                'short' => 'مقاس 34×22×13 سم لحماية علبة الكوتشي أثناء الشحن (ربطة 25)',
                'desc' => 'تحمي علبة الحذاء الأصلية من التلف أو الكسر أثناء التسليم.',
                'variants' => [
                    ['sku' => 'ESF-SHOE-25', 'label' => 'مقاس قياسي 34×22×13 سم (25 كرتونة)', 'cost' => 195, 'price' => 280, 'compare' => 315, 'stock' => 26, 'low' => 5, 'tiers' => [['min_qty' => 4, 'unit_price' => 260]]],
                ],
            ],
            [
                'slug' => 'polymailer-economy-white', 'cat' => 'polymailer-bags', 'img' => 'polymailer-bags.jpg', 'featured' => true,
                'mode' => EasyfyStockMode::TRACKED,
                'name' => 'أكياس شحن بوليميلر أبيض مضاد للماء',
                'short' => 'لاصق ذاتي قوي غير قابل للفتح (باكت 100 كيس بـ 3 مقاسات)',
                'desc' => 'خامة 60 ميكرون عالية المرونة ببطانة داخلية سوداء تمنع الرؤية وتحمي الملابس.',
                'variants' => [
                    ['sku' => 'ESF-PLY-2535', 'label' => '25×35 سم (100 كيس)', 'cost' => 115, 'price' => 165, 'compare' => 195, 'stock' => 80, 'low' => 15, 'tiers' => [['min_qty' => 5, 'unit_price' => 150], ['min_qty' => 10, 'unit_price' => 140]]],
                    ['sku' => 'ESF-PLY-3545', 'label' => '35×45 سم (100 كيس)', 'cost' => 165, 'price' => 235, 'compare' => 270, 'stock' => 65, 'low' => 12, 'tiers' => [['min_qty' => 5, 'unit_price' => 215], ['min_qty' => 10, 'unit_price' => 200]]],
                    ['sku' => 'ESF-PLY-4555', 'label' => '45×55 سم للشتوي (100 كيس)', 'cost' => 230, 'price' => 320, 'compare' => 360, 'stock' => 34, 'low' => 8, 'tiers' => [['min_qty' => 5, 'unit_price' => 295]]],
                ],
            ],
            [
                'slug' => 'polymailer-matte-colors', 'cat' => 'polymailer-bags', 'img' => 'polymailer-bags.jpg',
                'mode' => EasyfyStockMode::TRACKED,
                'name' => 'أكياس شحن بوليميلر ألوان براندات فاخرة',
                'short' => 'ألوان أسود مطفي وبنفسجي رويال (باكت 100 كيس 35×45 سم)',
                'desc' => 'تمنح عميلك تجربة فتح شحنة مميزة تعكس قيمة البراند بتكلفة اقتصادية.',
                'variants' => [
                    ['sku' => 'ESF-PLY-BLK35', 'label' => 'أسود مطفي 35×45 سم (100 كيس)', 'cost' => 190, 'price' => 265, 'compare' => 300, 'stock' => 52, 'low' => 10, 'tiers' => [['min_qty' => 5, 'unit_price' => 245]]],
                    ['sku' => 'ESF-PLY-PRP35', 'label' => 'بنفسجي رويال 35×45 سم (100 كيس)', 'cost' => 195, 'price' => 275, 'compare' => 310, 'stock' => 28, 'low' => 8, 'tiers' => [['min_qty' => 5, 'unit_price' => 255]]],
                ],
            ],
            [
                'slug' => 'thermal-barcode-50x30', 'cat' => 'thermal-labels', 'img' => 'thermal-labels.jpg', 'featured' => true,
                'mode' => EasyfyStockMode::TRACKED,
                'name' => 'رول استيكر باركود حراري 50×30 مم',
                'short' => 'طباعة واضحة فورية بدون حبر متوافق مع طابعات Xprinter وZebra',
                'desc' => 'مقاس مثالي لطباعة باركود المقاسات والألوان في المحل والمخزن.',
                'variants' => [
                    ['sku' => 'ESF-BRC-1R', 'label' => 'رول واحد (1000 ملصق)', 'cost' => 42, 'price' => 68, 'compare' => 80, 'stock' => 120, 'low' => 20, 'tiers' => [['min_qty' => 10, 'unit_price' => 58], ['min_qty' => 25, 'unit_price' => 52]]],
                    ['sku' => 'ESF-BRC-5R', 'label' => 'باكت 5 رولات (5000 ملصق)', 'cost' => 195, 'price' => 295, 'compare' => 340, 'stock' => 35, 'low' => 6, 'tiers' => [['min_qty' => 4, 'unit_price' => 270]]],
                ],
            ],
            [
                'slug' => 'thermal-waybill-a6', 'cat' => 'thermal-labels', 'img' => 'thermal-labels.jpg', 'featured' => true,
                'mode' => EasyfyStockMode::TRACKED,
                'name' => 'رول بوليصات شحن حراري A6 (100×150 مم)',
                'short' => 'مقاوم للرطوبة والاحتكاك لجميع شركات الشحن (بوسطة / أرامكس / Mylerz)',
                'desc' => 'صمغ فائق الثبات على الأكياس البوليميلر والكراتين حتى في الأجواء الحارة.',
                'variants' => [
                    ['sku' => 'ESF-WB-500', 'label' => 'رول 500 بوليصة شحن', 'cost' => 115, 'price' => 165, 'compare' => 190, 'stock' => 70, 'low' => 12, 'tiers' => [['min_qty' => 5, 'unit_price' => 150], ['min_qty' => 12, 'unit_price' => 138]]],
                    ['sku' => 'ESF-WB-10R', 'label' => 'كرتونة 10 رولات (5000 بوليصة)', 'cost' => 1080, 'price' => 1380, 'compare' => 1650, 'stock' => 14, 'low' => 3, 'tiers' => []],
                ],
            ],
            [
                'slug' => 'thermal-pos-80mm', 'cat' => 'thermal-labels', 'img' => 'thermal-labels.jpg',
                'mode' => EasyfyStockMode::TRACKED,
                'name' => 'رول ورق كاشير حراري 80×70 مم',
                'short' => 'ورق ناصع البياض لطباعة فواتير الكاشير والاستبدال والورديات (باكت 10)',
                'desc' => 'خالي من الغبار للحفاظ على رأس الطباعة الحرارية لأطول عمر ممكن.',
                'variants' => [
                    ['sku' => 'ESF-POS-80', 'label' => 'باكت 10 رولات 80 مم', 'cost' => 240, 'price' => 330, 'compare' => 375, 'stock' => 25, 'low' => 5, 'tiers' => [['min_qty' => 3, 'unit_price' => 305]]],
                ],
            ],
            [
                'slug' => 'packing-tape-heavy', 'cat' => 'bubble-wrap-tape', 'img' => 'bubble-wrap-tape.jpg',
                'mode' => EasyfyStockMode::TRACKED,
                'name' => 'شريط لاصق تغليف 48 مم × 90 ياردة',
                'short' => 'لاصق أكريليك قوي جداً لا يفك مع كراتين الشحن الثقيلة (باكت 6 بكرات)',
                'desc' => 'صمغ عالي اللزوجة يلتصق بإحكام على الكرتون المقوّى والنايلون.',
                'variants' => [
                    ['sku' => 'ESF-TAPE-CLR6', 'label' => 'شفاف (باكت 6 بكرات)', 'cost' => 145, 'price' => 210, 'compare' => 240, 'stock' => 4, 'low' => 6, 'tiers' => [['min_qty' => 5, 'unit_price' => 190]]],
                    ['sku' => 'ESF-TAPE-BRN6', 'label' => 'هافان بني (باكت 6 بكرات)', 'cost' => 145, 'price' => 210, 'compare' => 240, 'stock' => 30, 'low' => 6, 'tiers' => [['min_qty' => 5, 'unit_price' => 190]]],
                ],
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function unlimitedCatalog(): array
    {
        return [
            [
                'slug' => 'bubble-wrap-roll', 'cat' => 'bubble-wrap-tape', 'img' => 'bubble-wrap-tape.jpg', 'featured' => true,
                'mode' => EasyfyStockMode::UNLIMITED,
                'name' => 'رول بابل راب فقاعات حماية (50 متر)',
                'short' => 'حماية مثالية للزجاج والعطور والإلكترونيات من الصدمات',
                'desc' => 'فقاعات هوائية مزدوجة الطبقة متوفرة للتوريد الفوري بدون قيود كمية.',
                'variants' => [
                    ['sku' => 'ESF-BBL-50', 'label' => 'عرض 50 سم × 50 متر', 'cost' => 185, 'price' => 260, 'compare' => 295, 'tiers' => [['min_qty' => 4, 'unit_price' => 240]]],
                    ['sku' => 'ESF-BBL-100', 'label' => 'عرض 100 سم × 50 متر', 'cost' => 350, 'price' => 480, 'compare' => 540, 'tiers' => [['min_qty' => 4, 'unit_price' => 445]]],
                ],
            ],
            [
                'slug' => 'stretch-film-pallet', 'cat' => 'bubble-wrap-tape', 'img' => 'bubble-wrap-tape.jpg',
                'mode' => EasyfyStockMode::UNLIMITED,
                'name' => 'رول استرتش فيلم شفاف لتغليف الطرود',
                'short' => 'استرتش عالي المرونة والشد لحماية الكراتين من الأتربة والأمطار',
                'desc' => 'متوفر بوزن اقتصادي للتغليف اليدوي ووزن ثقيل للمخازن.',
                'variants' => [
                    ['sku' => 'ESF-STR-22', 'label' => 'رول 2.2 كجم — عرض 50 سم', 'cost' => 190, 'price' => 265, 'tiers' => [['min_qty' => 6, 'unit_price' => 245]]],
                    ['sku' => 'ESF-STR-30', 'label' => 'رول ثقيل 3 كجم — عرض 50 سم', 'cost' => 255, 'price' => 350, 'tiers' => [['min_qty' => 6, 'unit_price' => 325]]],
                ],
            ],
            [
                'slug' => 'padded-bubble-envelopes', 'cat' => 'polymailer-bags', 'img' => 'padded-envelopes.jpg',
                'mode' => EasyfyStockMode::UNLIMITED,
                'name' => 'أظرف شحن مبطنة بابلز للإكسسوارات والكوزمتكس',
                'short' => 'ظرف كرافت أو أبيض مبطن بطبقة بابل داخلية لحماية المنتجات الصغيرة (50 ظرف)',
                'desc' => 'ممتاز للساعات والمجوهرات ومستحضرات التجميل والنظارات.',
                'variants' => [
                    ['sku' => 'ESF-ENV-1825', 'label' => 'كرافت 18×25 سم (50 ظرف)', 'cost' => 170, 'price' => 240, 'tiers' => [['min_qty' => 4, 'unit_price' => 220]]],
                    ['sku' => 'ESF-ENV-2230', 'label' => 'أبيض 22×30 سم (50 ظرف)', 'cost' => 220, 'price' => 305, 'tiers' => [['min_qty' => 4, 'unit_price' => 280]]],
                ],
            ],
            [
                'slug' => 'tape-dispenser-gun', 'cat' => 'bubble-wrap-tape', 'img' => 'packing-tools.jpg',
                'mode' => EasyfyStockMode::UNLIMITED,
                'name' => 'ديسبنسر ومشد تيب يدوي معدني ثقيل',
                'short' => 'أداة سريعة لتغليف الكراتين ببكرة 48 مم بمقبض مريح',
                'desc' => 'يسرّع تغليف مئات الأوردرات يومياً مع شفرة قص فولاذية.',
                'variants' => [
                    ['sku' => 'ESF-DISP-50', 'label' => 'مقاس قياسي حتى 50 مم', 'cost' => 130, 'price' => 195, 'compare' => 230, 'tiers' => []],
                ],
            ],
            [
                'slug' => 'thermal-label-printer-a6', 'cat' => 'thermal-labels', 'img' => 'packing-tools.jpg', 'featured' => true,
                'mode' => EasyfyStockMode::UNLIMITED,
                'name' => 'طابعة بوليصات وباركود حرارية USB + Bluetooth',
                'short' => 'تدعم الطباعة المباشرة من الموبايل والكمبيوتر حتى مقاس 110 مم بدون حبر',
                'desc' => 'متوافقة تماماً مع فواتير وبوليصات وبادجات الباركود في Easyfy وShopify وWooCommerce.',
                'variants' => [
                    ['sku' => 'ESF-PRNT-A6', 'label' => 'نسخة USB + Bluetooth + ضمان عام', 'cost' => 2650, 'price' => 3350, 'compare' => 3800, 'tiers' => []],
                ],
            ],
            [
                'slug' => 'thank-you-cards-pack', 'cat' => 'shipping-boxes', 'img' => 'custom-printed-bags.jpg',
                'mode' => EasyfyStockMode::UNLIMITED,
                'name' => 'كروت شكر جاهزة للعملاء لرفع معدل التقييم (200 كارت)',
                'short' => 'طباعة كوشيه 350 جرام سوليفان مط لتدعيم ولاء عملاء المتجر',
                'desc' => 'كروت أنيقة بتصميم عام تناسب كل المتاجر الإلكترونية.',
                'variants' => [
                    ['sku' => 'ESF-CRD-200', 'label' => 'باكت 200 كارت 9×5.5 سم', 'cost' => 85, 'price' => 145, 'tiers' => [['min_qty' => 3, 'unit_price' => 125]]],
                ],
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function madeToOrderCatalog(): array
    {
        return [
            [
                'slug' => 'custom-printed-polymailer', 'cat' => 'custom-printed', 'img' => 'custom-printed-bags.jpg', 'featured' => true,
                'mode' => EasyfyStockMode::MADE_TO_ORDER, 'lead_days' => 5, 'min_qty' => 500,
                'custom_note' => true, 'note_label' => 'اكتب لون الكيس ولون الطباعة وبيانات البراند المطلوبة', 'artwork' => true,
                'name' => 'أكياس شحن بوليميلر مطبوعة بلوجو براندك',
                'short' => 'تصنيع خاص باسم ولوجو متجرك (أقل كمية 500 كيس — تجهيز 5 أيام)',
                'desc' => 'ارفع ملف اللوجو واكتب الألوان المطلوبة وسيتواصل فريقنا لاعتماد البروفة قبل الطباعة.',
                'variants' => [
                    ['sku' => 'ESF-CST-PLY30', 'label' => 'مقاس 30×40 سم (طباعة لون واحد)', 'cost' => 2.1, 'price' => 3.25, 'min_qty' => 500, 'tiers' => [['min_qty' => 1000, 'unit_price' => 2.85], ['min_qty' => 3000, 'unit_price' => 2.45]]],
                    ['sku' => 'ESF-CST-PLY35', 'label' => 'مقاس 35×45 سم (طباعة لونين)', 'cost' => 2.6, 'price' => 3.95, 'min_qty' => 500, 'tiers' => [['min_qty' => 1000, 'unit_price' => 3.50]]],
                ],
            ],
            [
                'slug' => 'custom-kraft-shopping-bags', 'cat' => 'custom-printed', 'img' => 'custom-printed-bags.jpg', 'featured' => true,
                'mode' => EasyfyStockMode::MADE_TO_ORDER, 'lead_days' => 7, 'min_qty' => 200,
                'custom_note' => true, 'note_label' => 'اذكر لون الشنطة والمقاس وهل تريد طباعة على وجه واحد أم وجهين', 'artwork' => true,
                'name' => 'شنط ورق كرافت / كوشيه مطبوعة لليد والهدايا',
                'short' => 'شنط بوتيك فاخرة بيد مبرومة أو حبل قطن مطبوعة بلوجو متجرك (أقل طلب 200 شنطة)',
                'desc' => 'ترفع قيمة علامتك التجارية عند التسليم في الفرع أو عبر المندوب.',
                'variants' => [
                    ['sku' => 'ESF-CST-BAG25', 'label' => 'وسط 25×35×10 سم', 'cost' => 8.5, 'price' => 13.5, 'min_qty' => 200, 'tiers' => [['min_qty' => 500, 'unit_price' => 11.5]]],
                    ['sku' => 'ESF-CST-BAG35', 'label' => 'كبير 35×45×12 سم', 'cost' => 11.0, 'price' => 17.5, 'min_qty' => 200, 'tiers' => [['min_qty' => 500, 'unit_price' => 15.0]]],
                ],
            ],
            [
                'slug' => 'custom-printed-mailer-box', 'cat' => 'custom-printed', 'img' => 'mailer-box.jpg',
                'mode' => EasyfyStockMode::MADE_TO_ORDER, 'lead_days' => 7, 'min_qty' => 100,
                'custom_note' => true, 'note_label' => 'حدد لون الكرتون والطباعة (خارجية أم داخلية أيضاً)', 'artwork' => true,
                'name' => 'بوكسات شحن Mailer Box مطبوعة باسم البراند',
                'short' => 'طباعة فلكسو أو سلك سكرين دقيقة على بوكسات الملابس والأحذية (من 100 بوكس)',
                'desc' => 'مخصصة لمتاجر الملابس والأحذية والبراندات التي تهتم بتجربة Unboxing احترافية.',
                'variants' => [
                    ['sku' => 'ESF-CST-BOXM', 'label' => '32×24×10 سم (طباعة خارجية)', 'cost' => 16.0, 'price' => 24.5, 'min_qty' => 100, 'tiers' => [['min_qty' => 300, 'unit_price' => 21.0]]],
                    ['sku' => 'ESF-CST-BOXL', 'label' => '36×28×12 سم (طباعة داخل + خارج)', 'cost' => 21.0, 'price' => 32.0, 'min_qty' => 100, 'tiers' => [['min_qty' => 300, 'unit_price' => 28.0]]],
                ],
            ],
            [
                'slug' => 'custom-printed-packing-tape', 'cat' => 'custom-printed', 'img' => 'bubble-wrap-tape.jpg',
                'mode' => EasyfyStockMode::MADE_TO_ORDER, 'lead_days' => 6, 'min_qty' => 36,
                'custom_note' => true, 'note_label' => 'اكتب لون الخلفية (أبيض / شفاف / بني) ولون طباعة اللوجو', 'artwork' => true,
                'name' => 'شريط لاصق تغليف مطبوع باسم ولوجو المتجر',
                'short' => 'يغلف كراتينك ويحميها من الفتح أثناء الشحن مع دعاية مستمرة لبراندك',
                'desc' => 'أقل كمية طلب كرتونة واحدة (36 بكرة × 66 متر).',
                'variants' => [
                    ['sku' => 'ESF-CST-TAPE', 'label' => 'بكرة 48 مم × 66 متر (طباعة لونين)', 'cost' => 42.0, 'price' => 62.0, 'min_qty' => 36, 'tiers' => [['min_qty' => 72, 'unit_price' => 54.0]]],
                ],
            ],
            [
                'slug' => 'custom-seal-stickers', 'cat' => 'custom-printed', 'img' => 'custom-printed-bags.jpg',
                'mode' => EasyfyStockMode::MADE_TO_ORDER, 'lead_days' => 3, 'min_qty' => 1,
                'custom_note' => true, 'note_label' => 'حدد الشكل (دائري / مستطيل) ومقاس الاستيكر إن وجد', 'artwork' => true,
                'name' => 'استيكرات تقفيل وبادجات لوجو مطبوعة (باكت 1000)',
                'short' => 'استيكرات دائرية أو مستطيلة مقاومة للماء لتقفيل ورق التغليف والأكياس',
                'desc' => 'قص ديجيتال جاهز على النزع مع جودة ألوان فائقة خلال 3 أيام عمل.',
                'variants' => [
                    ['sku' => 'ESF-CST-STK4', 'label' => 'مقاس 4 سم (1000 استيكر)', 'cost' => 165, 'price' => 260, 'min_qty' => 1, 'tiers' => [['min_qty' => 3, 'unit_price' => 230]]],
                    ['sku' => 'ESF-CST-STK6', 'label' => 'مقاس 6 سم (1000 استيكر)', 'cost' => 240, 'price' => 360, 'min_qty' => 1, 'tiers' => [['min_qty' => 3, 'unit_price' => 320]]],
                ],
            ],
        ];
    }
}
