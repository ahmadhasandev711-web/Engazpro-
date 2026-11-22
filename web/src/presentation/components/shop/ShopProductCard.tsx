import React from 'react';
import { Layers, Package, Sparkles, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EasyfyProduct, EasyfyStockMode, formatCurrency } from '@pos-mandob/shared';
import { STOCK_MODE_META } from '../admin/easyfy/easyfyUiMeta';
import { Badge, Card } from '../ui';

interface ShopProductCardProps {
  product: EasyfyProduct;
}

export const ShopProductCard: React.FC<ShopProductCardProps> = ({ product }) => {
  const activeVariants = (product.variants ?? []).filter((v) => v.is_active);
  const displayVariants = activeVariants.length > 0 ? activeVariants : product.variants ?? [];
  const prices = displayVariants.map((v) => Number(v.selling_price));
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const comparePrices = displayVariants
    .map((v) => (v.compare_at_price ? Number(v.compare_at_price) : 0))
    .filter((p) => p > 0);
  const firstCompare = comparePrices.length > 0 ? Math.min(...comparePrices) : null;

  const hasWholesaleTiers = displayVariants.some((v) => (v.price_tiers ?? []).length > 0);
  const primaryImage =
    product.images?.find((img) => img.is_primary)?.image_path || product.images?.[0]?.image_path;
  const modeMeta = STOCK_MODE_META[product.stock_mode] ?? {
    label: String(product.stock_mode),
    tone: 'neutral' as const,
  };

  const isTracked = product.stock_mode === EasyfyStockMode.TRACKED;
  const totalStock = displayVariants.reduce((sum, v) => sum + Number(v.stock_quantity || 0), 0);
  const isOutOfStock = isTracked && totalStock <= 0;

  return (
    <Link to={`/shop/products/${product.slug || product.id}`} className="group block h-full">
      <Card className="h-full overflow-hidden flex flex-col border-line hover:border-brand/50 hover:shadow-md transition-all">
        <div className="relative aspect-[4/3] bg-surface-2 overflow-hidden">
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted">
              <Package className="w-12 h-12 opacity-40" />
            </div>
          )}

          <div className="absolute top-2.5 right-2.5 flex flex-wrap gap-1.5">
            {product.is_featured && (
              <Badge tone="brand" className="shadow-xs">
                <Sparkles className="w-3 h-3" />
                <span>مميز</span>
              </Badge>
            )}
            <Badge tone={isOutOfStock ? 'bad' : modeMeta.tone} className="shadow-xs">
              {isOutOfStock ? 'نفد المخزون مؤقتاً' : modeMeta.label}
            </Badge>
          </div>
        </div>

        <div className="p-4 flex-1 flex flex-col justify-between gap-3">
          <div className="space-y-1.5">
            {product.category && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-ink">
                <Tag className="w-3 h-3" />
                {product.category.name}
              </span>
            )}
            <h3 className="font-black text-sm sm:text-base text-ink group-hover:text-brand-ink transition-colors line-clamp-2">
              {product.name}
            </h3>
            {product.short_description && (
              <p className="text-xs text-muted line-clamp-2">{product.short_description}</p>
            )}
          </div>

          <div className="pt-3 border-t border-line flex items-end justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-base font-black text-brand tabular-nums">
                  {formatCurrency(minPrice)}
                </span>
                {maxPrice > minPrice && (
                  <span className="text-xs text-muted font-bold tabular-nums">
                    - {formatCurrency(maxPrice)}
                  </span>
                )}
              </div>
              {firstCompare && firstCompare > minPrice && (
                <p className="text-[11px] text-muted line-through tabular-nums">
                  {formatCurrency(firstCompare)}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-1">
              {hasWholesaleTiers && (
                <Badge tone="ok" className="text-[10px]">
                  أسعار جملة
                </Badge>
              )}
              {displayVariants.length > 1 && (
                <span className="text-[11px] text-muted inline-flex items-center gap-1 font-bold">
                  <Layers className="w-3 h-3" />
                  {displayVariants.length} مقاسات
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
};
