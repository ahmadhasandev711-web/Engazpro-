import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Package, X, ScanBarcode, Building2 } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { Badge, BadgeTone } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { ProductThumbnail } from '../common/ProductThumbnail';

export interface ProductItem {
  id: number;
  name: string;
  code: string;
  barcode?: string;
  image_url?: string | null;
  category_id?: number | null;
  type?: string;
  has_expiry?: boolean;
  has_variants?: boolean;
  regular_price?: number | null;
  sale_price: number;
  purchase_price?: number | null;
  quantity: number;
  category_name?: string;
  unit?: string;
  sub_unit?: string | null;
  sub_unit_factor?: number | null;
  sub_unit_price?: number | null;
  variants?: any[];
  batches?: any[];
}

export interface PosCategoryChip {
  id: number;
  name: string;
  products_count?: number;
}

interface PosProductCatalogProps {
  products: ProductItem[];
  totalCount: number;
  browseTotal: number | null;
  categories: PosCategoryChip[];
  selectedCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
  isLoading: boolean;
  isSearching: boolean;
  isFetchingMore: boolean;
  onNearEnd: () => void;
  listKey: string;
  searchMs: number | null;
  onAddToCart: (product: ProductItem) => void;
  onCheckBranchAvailability?: (product: ProductItem) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onScanBarcode?: (barcode: string) => boolean | Promise<boolean>;
  onOpenCameraScanner?: () => void;
}

const DESKTOP_ROW_HEIGHT = 166;
const MOBILE_ROW_HEIGHT = 88;

const columnCount = (width: number): number => {
  if (width >= 900) return 4;
  if (width >= 520) return 3;
  return 1;
};

const stockOf = (product: ProductItem): number => {
  const hasVariants = Boolean(product.has_variants || product.variants?.length);
  const variantStockSum = product.variants?.reduce((sum, variant) => sum + (Number(variant.quantity) || 0), 0) ?? 0;
  if (!hasVariants) return product.quantity ?? 0;
  return product.variants?.length ? variantStockSum : (product.quantity ?? 0);
};

const getStockTone = (stock: number): BadgeTone => {
  if (stock <= 0) return 'bad';
  if (stock <= 3) return 'warn';
  return 'neutral';
};

const getDiscountPercent = (product: ProductItem): number => {
  const reg = Number(product.regular_price || 0);
  const sale = Number(product.sale_price || 0);
  if (reg <= sale || reg <= 0) return 0;
  return Math.round(((reg - sale) / reg) * 100);
};

const PosProductBadges: React.FC<{ product: ProductItem; compact?: boolean }> = ({ product, compact }) => {
  const discountPct = getDiscountPercent(product);
  const hasVariants = Boolean(product.has_variants || product.variants?.length);
  const hasExpiry = Boolean(product.has_expiry || product.batches?.length);

  if (!discountPct && !hasVariants && !hasExpiry && !product.sub_unit) {
    return null;
  }

  return (
    <div className={compact ? 'flex items-center gap-1 overflow-hidden' : 'flex flex-wrap items-center gap-1 mt-1'}>
      {discountPct > 0 && (
        <Badge tone="bad" className="text-2xs px-1.5 py-0.5 rounded-md font-bold shrink-0">
          خصم {discountPct}%
        </Badge>
      )}
      {hasVariants && (
        <Badge tone="info" className="text-2xs px-1.5 py-0.5 rounded-md font-bold shrink-0">
          {product.variants?.length ? `${product.variants.length} مقاس/لون` : 'متغيرات'}
        </Badge>
      )}
      {hasExpiry && (
        <Badge tone="warn" className="text-2xs px-1.5 py-0.5 rounded-md font-bold shrink-0">
          صلاحية
        </Badge>
      )}
      {Boolean(product.sub_unit) && !compact && (
        <Badge tone="neutral" className="text-2xs px-1.5 py-0.5 rounded-md font-bold shrink-0">
          {product.sub_unit}
        </Badge>
      )}
    </div>
  );
};

const PosProductMobileRow: React.FC<{
  product: ProductItem;
  onAddToCart: (product: ProductItem) => void;
  onCheckBranchAvailability?: (product: ProductItem) => void;
}> = ({
  product,
  onAddToCart,
  onCheckBranchAvailability,
}) => {
  const stock = stockOf(product);
  const isOutOfStock = stock <= 0;
  const hasDiscount = getDiscountPercent(product) > 0;
  const stockTone = getStockTone(stock);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAddToCart(product)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAddToCart(product);
        }
      }}
      style={{ height: MOBILE_ROW_HEIGHT }}
      className={`w-full px-3 py-2 bg-panel hover:bg-surface-2 active:scale-[0.99] border border-line hover:border-brand-soft rounded-2xl transition-all text-right flex items-center justify-between gap-2.5 shadow-2xs group focus:outline-none focus:ring-2 focus:ring-brand overflow-hidden cursor-pointer ${
        isOutOfStock ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <ProductThumbnail
          src={product.image_url}
          alt={product.name}
          className="w-12 h-12 rounded-xl"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <h4 className="text-sm font-bold text-ink group-hover:text-brand truncate leading-tight">
            {product.name}
          </h4>
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Badge tone={stockTone} className="text-2xs px-1.5 py-0.5 shrink-0">
              {isOutOfStock ? 'نفذ' : `${stock} ${product.unit || 'قطعة'}`}
            </Badge>
            {product.code && (
              <span className="truncate max-w-[84px] bg-surface-2 text-muted px-1.5 py-0.5 rounded-md text-2xs font-medium tabular-nums shrink-0">
                {product.code}
              </span>
            )}
            <PosProductBadges product={product} compact />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <div className="text-left">
          <span className="text-sm font-black text-brand tabular-nums block leading-tight">
            {formatCurrency(product.sale_price)}
          </span>
          {hasDiscount && (
            <span className="line-through text-muted text-2xs tabular-nums block">
              {formatCurrency(Number(product.regular_price))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onCheckBranchAvailability && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCheckBranchAvailability(product);
              }}
              className="w-8 h-8 rounded-xl bg-surface-2 text-muted hover:text-brand-ink hover:bg-brand-soft border border-line flex items-center justify-center transition-colors shrink-0"
              title="الرصيد في باقي الفروع"
              aria-label={`الرصيد في باقي الفروع - ${product.name}`}
            >
              <Building2 className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="w-8 h-8 rounded-xl bg-brand-soft text-brand-ink flex items-center justify-center text-sm font-bold group-hover:bg-brand group-hover:text-on-brand transition-colors shrink-0">
            +
          </div>
        </div>
      </div>
    </div>
  );
};

const PosProductCard: React.FC<{
  product: ProductItem;
  onAddToCart: (product: ProductItem) => void;
  onCheckBranchAvailability?: (product: ProductItem) => void;
}> = ({
  product,
  onAddToCart,
  onCheckBranchAvailability,
}) => {
  const stock = stockOf(product);
  const isOutOfStock = stock <= 0;
  const hasDiscount = getDiscountPercent(product) > 0;
  const stockTone = getStockTone(stock);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAddToCart(product)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAddToCart(product);
        }
      }}
      style={{ height: DESKTOP_ROW_HEIGHT }}
      className={`relative flex flex-col justify-between p-3.5 bg-panel hover:bg-surface-2 active:scale-[0.98] border border-line hover:border-brand-soft rounded-2xl transition-all text-right shadow-xs hover:shadow-md group focus:outline-none focus:ring-2 focus:ring-brand overflow-hidden cursor-pointer ${
        isOutOfStock ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-1.5 w-full text-2xs mb-2">
        {product.code ? (
          <span className="truncate max-w-[96px] bg-surface-2 text-muted px-1.5 py-0.5 rounded-md font-medium tabular-nums">
            {product.code}
          </span>
        ) : (
          <span />
        )}
        <Badge tone={stockTone} className="text-2xs px-2 py-0.5 shrink-0">
          {isOutOfStock ? 'نفذ' : `${stock} ${product.unit || 'قطعة'}`}
        </Badge>
      </div>

      <div className="flex items-start gap-2.5 my-1 min-h-0 flex-1">
        <ProductThumbnail
          src={product.image_url}
          alt={product.name}
          className="w-10 h-10 rounded-xl mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <h4 className="text-xs sm:text-sm font-black text-ink group-hover:text-brand line-clamp-2 leading-tight">
            {product.name}
          </h4>
          <PosProductBadges product={product} />
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-line flex items-center justify-between w-full">
        <div className="flex items-baseline gap-1.5 overflow-hidden">
          <span className="text-xs sm:text-sm font-black text-brand tabular-nums">
            {formatCurrency(product.sale_price)}
          </span>
          {hasDiscount && (
            <span className="line-through text-muted text-2xs tabular-nums">
              {formatCurrency(Number(product.regular_price))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onCheckBranchAvailability && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCheckBranchAvailability(product);
              }}
              className="w-6 h-6 rounded-lg bg-surface-2 text-muted hover:text-brand-ink hover:bg-brand-soft border border-line flex items-center justify-center transition-colors shrink-0"
              title="الرصيد في باقي الفروع"
              aria-label={`الرصيد في باقي الفروع - ${product.name}`}
            >
              <Building2 className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="w-6 h-6 rounded-lg bg-brand-soft text-brand-ink flex items-center justify-center text-xs font-bold group-hover:bg-brand group-hover:text-on-brand transition-colors shrink-0">
            +
          </div>
        </div>
      </div>
    </div>
  );
};

export const PosProductCatalog: React.FC<PosProductCatalogProps> = ({
  products,
  totalCount,
  browseTotal,
  categories,
  selectedCategoryId,
  onSelectCategory,
  isLoading,
  isSearching,
  isFetchingMore,
  onNearEnd,
  listKey,
  searchMs,
  onAddToCart,
  onCheckBranchAvailability,
  searchInputRef,
  searchQuery,
  setSearchQuery,
  onScanBarcode,
  onOpenCameraScanner,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const [metrics, setMetrics] = useState({ width: 640, height: 640, scrollTop: 0 });

  const shownProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => {
      return (
        (product.name && product.name.toLowerCase().includes(query)) ||
        (product.code && product.code.toLowerCase().includes(query)) ||
        (product.barcode && product.barcode.toLowerCase().includes(query)) ||
        product.variants?.some(
          (variant) =>
            (variant.barcode && String(variant.barcode).toLowerCase().includes(query)) ||
            (variant.code && String(variant.code).toLowerCase().includes(query)) ||
            (variant.name && String(variant.name).toLowerCase().includes(query))
        )
      );
    });
  }, [products, searchQuery]);

  useEffect(() => {
    setMetrics((current) => ({ ...current, scrollTop: 0 }));
  }, [listKey]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measure = () => {
      setMetrics((current) => ({
        ...current,
        width: element.clientWidth,
        height: element.clientHeight,
      }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [listKey]);

  const cols = columnCount(metrics.width);
  const isMobileList = cols === 1;
  const rowHeight = isMobileList ? 88 : 166;
  const rowGap = isMobileList ? 8 : 12;
  const rowStride = rowHeight + rowGap;
  const rowCount = Math.ceil(shownProducts.length / cols);
  const startRow = Math.max(0, Math.floor(metrics.scrollTop / rowStride) - 1);
  const visibleRows = Math.ceil(metrics.height / rowStride) + 3;
  const endRow = Math.min(rowCount, startRow + visibleRows);
  const slice = shownProducts.slice(startRow * cols, endRow * cols);
  const offset = startRow * rowStride;
  const totalHeight = rowCount * rowStride;

  const onScroll = () => {
    const element = scrollRef.current;
    if (!element || frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      setMetrics((current) => ({ ...current, scrollTop: element.scrollTop }));
      const overflows = element.scrollHeight > element.clientHeight + 40;
      const nearEnd = element.scrollHeight - element.scrollTop - element.clientHeight < 280;
      if (overflows && nearEnd) onNearEnd();
    });
  };

  const submitScan = () => {
    if (!searchQuery.trim() || !onScanBarcode) return;
    const code = searchQuery.trim();
    Promise.resolve(onScanBarcode(code)).then((found) => {
      if (found) setSearchQuery('');
    });
  };

  return (
    <div
      className="flex flex-col h-full bg-panel rounded-3xl border border-line shadow-xs overflow-hidden"
      data-pos-rendered={slice.length}
      data-pos-loaded={shownProducts.length}
      data-pos-search-ms={searchMs ?? undefined}
    >
      <div className="p-4 border-b border-line space-y-3 bg-panel/50">
        <div className="relative">
          <Search className="w-5 h-5 absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={searchInputRef}
            type="text"
            data-barcode-capture="true"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                e.preventDefault();
                submitScan();
              }
            }}
            placeholder="ابحث باسم الصنف أو امسح الباركود... [F2]"
            className="w-full pl-28 sm:pl-36 pr-11 py-3 bg-panel border border-line rounded-2xl text-sm font-medium text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand shadow-xs transition-all"
          />
          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1.5 text-muted hover:text-ink rounded-lg transition-colors cursor-pointer"
                title="مسح البحث"
                aria-label="مسح البحث"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold text-muted bg-surface-2 border border-line rounded-md pointer-events-none">
              F2
            </kbd>
            {onOpenCameraScanner && (
              <button
                type="button"
                onClick={onOpenCameraScanner}
                className="w-9 h-9 rounded-xl bg-brand-soft text-brand border border-brand/20 hover:bg-brand hover:text-on-brand flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="مسح الباركود بالكاميرا"
                aria-label="مسح الباركود بالكاميرا"
              >
                <ScanBarcode className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
            <button
              type="button"
              onClick={() => onSelectCategory(null)}
              className={`min-h-[36px] h-9 px-3.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center justify-center ${
                selectedCategoryId === null
                  ? 'bg-ink text-canvas shadow-xs'
                  : 'bg-panel text-muted border border-line hover:bg-surface-2 hover:text-ink'
              }`}
            >
              جميع الأصناف{browseTotal !== null ? ` (${browseTotal})` : ''}
            </button>
            {categories.map((category) => (
              <button
                type="button"
                key={category.id}
                onClick={() => onSelectCategory(category.id)}
                className={`min-h-[36px] h-9 px-3.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center justify-center ${
                  selectedCategoryId === category.id
                    ? 'bg-ink text-canvas shadow-xs'
                    : 'bg-panel text-muted border border-line hover:bg-surface-2 hover:text-ink'
                }`}
              >
                {category.name}
                {typeof category.products_count === 'number' ? ` (${category.products_count})` : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        key={listKey}
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto p-4 pb-28 lg:pb-4"
      >
        {isLoading && products.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted text-sm">
            جاري تحميل كتالوج الأصناف...
          </div>
        ) : shownProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6">
            <EmptyState
              icon={<Package className="w-6 h-6 text-muted" />}
              title={isSearching ? 'جاري البحث في كل الأصناف...' : 'لا يوجد صنف يطابق هذا البحث'}
              description={
                isSearching
                  ? 'البحث يتم على الكتالوج كامل، مش على الصفحة الظاهرة فقط.'
                  : 'تأكد من كتابة الاسم أو الباركود بشكل صحيح، أو أضف الصنف لقائمة المنتجات أولاً.'
              }
              className="bg-transparent border-0 py-8"
            />
          </div>
        ) : (
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div
              className={isMobileList ? 'absolute inset-x-0 grid gap-2' : 'absolute inset-x-0 grid gap-3'}
              style={{
                top: offset,
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
            >
              {slice.map((product) =>
                isMobileList ? (
                  <PosProductMobileRow
                    key={product.id}
                    product={product}
                    onAddToCart={onAddToCart}
                    onCheckBranchAvailability={onCheckBranchAvailability}
                  />
                ) : (
                  <PosProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={onAddToCart}
                    onCheckBranchAvailability={onCheckBranchAvailability}
                  />
                )
              )}
            </div>
          </div>
        )}
        {isFetchingMore && (
          <p className="text-center text-[11px] text-muted py-3">جاري تحميل المزيد...</p>
        )}
        {!isLoading && searchQuery.trim() && totalCount > shownProducts.length && isSearching && (
          <p className="text-center text-[11px] text-muted py-2">نتائج البحث: {totalCount}</p>
        )}
      </div>
    </div>
  );
};
