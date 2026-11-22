<?php

namespace App\Services\Easyfy;

use App\Models\Easyfy\EasyfyCategory;
use App\Models\Easyfy\EasyfyProduct;
use App\Models\Easyfy\EasyfyShippingZone;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

class EasyfyCatalogQueryService
{
    public function __construct(private readonly EasyfySettingsService $settingsService) {}

    public function getStorefrontData(): array
    {
        $categories = EasyfyCategory::where('is_active', true)->orderBy('sort_order')->orderBy('id')->get();
        $featured = EasyfyProduct::where('is_active', true)->where('is_featured', true)
            ->with(['category', 'images', 'variants' => fn ($q) => $q->where('is_active', true)->with('priceTiers')])
            ->orderBy('sort_order')->limit(12)->get();
        $zones = EasyfyShippingZone::where('is_active', true)->orderBy('sort_order')->orderBy('id')->get();

        return [
            'settings' => $this->settingsService->all(),
            'categories' => $categories,
            'featured_products' => $featured,
            'shipping_zones' => $zones,
        ];
    }

    public function paginateStorefrontProducts(array $filters = []): LengthAwarePaginator
    {
        $query = EasyfyProduct::where('is_active', true)
            ->with(['category', 'images', 'variants' => fn ($q) => $q->where('is_active', true)->with('priceTiers')])
            ->orderBy('sort_order')->orderByDesc('id');

        if (!empty($filters['category_id'])) {
            $query->where('category_id', (int) $filters['category_id']);
        }
        if (!empty($filters['stock_mode'])) {
            $query->where('stock_mode', $filters['stock_mode']);
        }
        if (!empty($filters['search'])) {
            $q = trim((string) $filters['search']);
            $query->where(fn ($sub) => $sub->where('name', 'like', "%{$q}%")->orWhere('short_description', 'like', "%{$q}%"));
        }

        return $query->paginate(min(max((int) ($filters['per_page'] ?? 24), 1), 60));
    }

    public function findStorefrontProductOrFail(string $slugOrId): EasyfyProduct
    {
        return EasyfyProduct::where('is_active', true)
            ->with(['category', 'images', 'variants' => fn ($q) => $q->where('is_active', true)->with('priceTiers')])
            ->where(fn ($q) => is_numeric($slugOrId) ? $q->where('id', (int) $slugOrId) : $q->where('slug', $slugOrId))
            ->firstOrFail();
    }

    public function paginateAdminProducts(array $filters = []): LengthAwarePaginator
    {
        $query = EasyfyProduct::with(['category', 'images', 'variants.priceTiers'])->orderByDesc('id');
        if (!empty($filters['category_id'])) {
            $query->where('category_id', (int) $filters['category_id']);
        }
        if (!empty($filters['stock_mode'])) {
            $query->where('stock_mode', $filters['stock_mode']);
        }
        if (!empty($filters['search'])) {
            $q = trim((string) $filters['search']);
            $query->where(fn ($sub) => $sub->where('name', 'like', "%{$q}%")
                ->orWhereHas('variants', fn ($vq) => $vq->where('sku', 'like', "%{$q}%")->orWhere('label', 'like', "%{$q}%")));
        }

        return $query->paginate(min(max((int) ($filters['per_page'] ?? 30), 1), 100));
    }

    public function listAllCategories(): Collection
    {
        return EasyfyCategory::withCount('products')->orderBy('sort_order')->orderBy('id')->get();
    }
}
