<?php

namespace App\Services\Easyfy;

use App\Enums\AdminAuditAction;
use App\Enums\Easyfy\EasyfyStockMode;
use App\Enums\Easyfy\EasyfyStockMovementType;
use App\Models\Easyfy\EasyfyCategory;
use App\Models\Easyfy\EasyfyCoupon;
use App\Models\Easyfy\EasyfyProduct;
use App\Models\Easyfy\EasyfyProductImage;
use App\Models\Easyfy\EasyfyProductVariant;
use App\Models\Easyfy\EasyfyShippingZone;
use App\Models\Easyfy\EasyfyStockMovement;
use App\Models\Easyfy\EasyfyVariantPriceTier;
use App\Models\User;
use App\Services\AdminAuditService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EasyfyCatalogAdminService
{
    public function __construct(
        private readonly EasyfyMediaService $mediaService,
        private readonly AdminAuditService $auditService,
    ) {}

    public function saveCategory(array $data, ?int $id = null): EasyfyCategory
    {
        $slug = $this->uniqueSlug($data['slug'] ?? $data['name'], EasyfyCategory::class, $id);
        $attrs = [
            'name' => $data['name'], 'slug' => $slug,
            'description' => $data['description'] ?? null,
            'sort_order' => (int) ($data['sort_order'] ?? 0),
            'is_active' => $data['is_active'] ?? true,
        ];

        return $id ? tap(EasyfyCategory::findOrFail($id))->update($attrs) : EasyfyCategory::create($attrs);
    }

    public function uploadCategoryImage(int $categoryId, UploadedFile $file): EasyfyCategory
    {
        $cat = EasyfyCategory::findOrFail($categoryId);
        $old = $cat->image_path;
        $cat->update(['image_path' => $this->mediaService->storeCatalogImage($file)]);
        $this->mediaService->deleteCatalogImage($old);

        return $cat->fresh();
    }

    public function saveProduct(User $admin, array $data, ?int $id = null): EasyfyProduct
    {
        return DB::transaction(function () use ($admin, $data, $id) {
            $product = $id ? EasyfyProduct::findOrFail($id) : new EasyfyProduct();
            $product->fill($this->extractProductAttributes($data, $id));
            $product->save();
            if (!empty($data['variants'])) {
                $this->syncProductVariants($admin, $product, $data['variants']);
            }
            $this->auditService->record(AdminAuditAction::EASYFY_PRODUCT_SAVED, "حفظ منتج Easyfy ({$product->name})", null, null, EasyfyProduct::class, $product->id, $admin);

            return $product->fresh(['category', 'images', 'variants.priceTiers']);
        });
    }

    public function uploadProductImage(int $productId, UploadedFile $file, bool $isPrimary = false, ?int $variantId = null): EasyfyProductImage
    {
        return DB::transaction(function () use ($productId, $file, $isPrimary, $variantId) {
            $product = EasyfyProduct::findOrFail($productId);
            $makePrimary = $isPrimary || !$product->images()->exists();
            if ($makePrimary) {
                $product->images()->update(['is_primary' => false]);
            }
            $nextSort = ((int) $product->images()->max('sort_order')) + 1;

            return EasyfyProductImage::create([
                'product_id' => $product->id, 'variant_id' => $variantId,
                'image_path' => $this->mediaService->storeCatalogImage($file),
                'is_primary' => $makePrimary, 'sort_order' => $nextSort,
            ]);
        });
    }

    public function deleteProductImage(int $imageId): void
    {
        $img = EasyfyProductImage::findOrFail($imageId);
        $productId = $img->product_id;
        $wasPrimary = $img->is_primary;
        $path = $img->image_path;
        $img->delete();
        $this->mediaService->deleteCatalogImage($path);
        if ($wasPrimary) {
            EasyfyProductImage::where('product_id', $productId)->first()?->update(['is_primary' => true]);
        }
    }

    public function listCoupons(): Collection
    {
        return EasyfyCoupon::orderByDesc('id')->get();
    }

    public function saveCoupon(User $admin, array $data, ?int $id = null): EasyfyCoupon
    {
        $attrs = array_merge($data, ['code' => strtoupper(trim((string) $data['code']))]);
        $coupon = $id ? tap(EasyfyCoupon::findOrFail($id))->update($attrs) : EasyfyCoupon::create($attrs);
        $this->auditService->record(AdminAuditAction::EASYFY_COUPON_SAVED, "حفظ كوبون Easyfy ({$coupon->code})", null, null, EasyfyCoupon::class, $coupon->id, $admin);

        return $coupon;
    }

    public function deleteCoupon(int $id): void
    {
        EasyfyCoupon::findOrFail($id)->delete();
    }

    public function listShippingZones(): Collection
    {
        return EasyfyShippingZone::orderBy('sort_order')->orderBy('id')->get();
    }

    public function saveShippingZone(array $data, ?int $id = null): EasyfyShippingZone
    {
        return $id ? tap(EasyfyShippingZone::findOrFail($id))->update($data) : EasyfyShippingZone::create($data);
    }

    public function deleteShippingZone(int $id): void
    {
        EasyfyShippingZone::findOrFail($id)->delete();
    }

    public function deleteCategory(int $id): void
    {
        EasyfyCategory::findOrFail($id)->delete();
    }

    public function deleteProduct(int $id): void
    {
        EasyfyProduct::findOrFail($id)->delete();
    }

    public function setPrimaryProductImage(int $productId, int $imageId): void
    {
        DB::transaction(function () use ($productId, $imageId) {
            EasyfyProduct::findOrFail($productId);
            EasyfyProductImage::where('product_id', $productId)->update(['is_primary' => false]);
            EasyfyProductImage::where('product_id', $productId)->findOrFail($imageId)->update(['is_primary' => true]);
        });
    }

    private function extractProductAttributes(array $data, ?int $id): array
    {
        return [
            'category_id' => $data['category_id'] ?? null, 'name' => $data['name'],
            'slug' => $this->uniqueSlug($data['slug'] ?? $data['name'], EasyfyProduct::class, $id),
            'short_description' => $data['short_description'] ?? null, 'description' => $data['description'] ?? null,
            'stock_mode' => EasyfyStockMode::from((string) $data['stock_mode']),
            'lead_time_days' => $data['lead_time_days'] ?? null,
            'min_order_qty' => (int) ($data['min_order_qty'] ?? 1),
            'allow_custom_note' => (bool) ($data['allow_custom_note'] ?? false),
            'custom_note_label' => $data['custom_note_label'] ?? null,
            'allow_artwork_upload' => (bool) ($data['allow_artwork_upload'] ?? false),
            'is_active' => (bool) ($data['is_active'] ?? true),
            'is_featured' => (bool) ($data['is_featured'] ?? false),
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ];
    }

    private function syncProductVariants(User $admin, EasyfyProduct $product, array $variantsPayload): void
    {
        $keptIds = [];
        foreach ($variantsPayload as $index => $row) {
            $variant = $this->upsertSingleVariant($admin, $product, $row, $index);
            $keptIds[] = $variant->id;
            if (array_key_exists('price_tiers', $row)) {
                $this->syncVariantPriceTiers($variant, (array) $row['price_tiers']);
            }
        }
        $product->variants()->whereNotIn('id', $keptIds)->update(['is_active' => false]);
    }

    private function upsertSingleVariant(User $admin, EasyfyProduct $product, array $row, int $index): EasyfyProductVariant
    {
        $variantId = isset($row['id']) ? (int) $row['id'] : null;
        $variant = $variantId ? EasyfyProductVariant::where('product_id', $product->id)->findOrFail($variantId) : new EasyfyProductVariant(['product_id' => $product->id]);
        $isNew = !$variant->exists;
        $initialQty = (int) ($row['stock_quantity'] ?? ($variant->stock_quantity ?? 0));
        $variant->fill([
            'sku' => $row['sku'] ?? ($variant->sku ?: 'ESF-' . strtoupper(Str::random(8))),
            'label' => $row['label'], 'attributes' => $row['attributes'] ?? null,
            'cost_price' => $row['cost_price'] ?? 0, 'selling_price' => $row['selling_price'],
            'compare_at_price' => $row['compare_at_price'] ?? null,
            'stock_quantity' => $isNew ? $initialQty : $variant->stock_quantity,
            'low_stock_threshold' => (int) ($row['low_stock_threshold'] ?? 5),
            'min_order_qty' => (int) ($row['min_order_qty'] ?? 1),
            'is_active' => (bool) ($row['is_active'] ?? true), 'sort_order' => (int) ($row['sort_order'] ?? $index),
        ])->save();
        if ($isNew && $product->stock_mode === EasyfyStockMode::TRACKED && $initialQty > 0) {
            EasyfyStockMovement::create([
                'variant_id' => $variant->id, 'type' => EasyfyStockMovementType::OPENING, 'quantity_delta' => $initialQty,
                'balance_after' => $initialQty, 'unit_cost' => $variant->cost_price, 'created_by' => $admin->id,
                'notes' => 'رصيد افتتاحي عند إنشاء الصنف', 'created_at' => now(),
            ]);
        }

        return $variant;
    }

    private function syncVariantPriceTiers(EasyfyProductVariant $variant, array $tiers): void
    {
        $variant->priceTiers()->delete();
        foreach ($tiers as $tier) {
            EasyfyVariantPriceTier::create([
                'variant_id' => $variant->id,
                'min_qty' => (int) $tier['min_qty'],
                'unit_price' => $tier['unit_price'],
            ]);
        }
    }

    private function uniqueSlug(string $source, string $modelClass, ?int $ignoreId): string
    {
        $base = Str::slug($source) ?: 'easyfy-' . Str::lower(Str::random(6));
        $candidate = $base;
        $counter = 1;
        while ($modelClass::where('slug', $candidate)->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))->exists()) {
            $candidate = "{$base}-{$counter}";
            $counter++;
        }

        return $candidate;
    }
}
