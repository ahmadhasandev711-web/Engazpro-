import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Package, X } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { Badge, BadgeTone } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

export interface ProductItem {
  id: number;
  name: string;
  code: string;
  barcode?: string;
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
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onScanBarcode?: (barcode: string) => boolean | Promise<boolean>;
}

const ROW_HEIGHT = 172;
const ROW_GAP = 12;
const ROW_STRIDE = ROW_HEIGHT + ROW_GAP;

const columnCount = (width: number): number => {
  if (width >= 900) return 4;
  if (width >= 520) return 3;
  return 2;
};

const stockOf = (product: ProductItem): number => {
  const hasVariants = Boolean(product.has_variants || product.variants?.length);
  const variantStockSum = product.variants?.reduce((sum, variant) => sum + (Number(variant.quantity) || 0), 0) ?? 0;
  if (!hasVariants) return product.quantity ?? 0;
  return product.variants?.length ? variantStockSum : (product.quantity ?? 0);
};

const getCategoryColorClass = (categoryId?: number | null): string => {
  if (categoryId === null || categoryId === undefined) {
    return 'bg-surface-2 text-muted';
  }
  const rem = Math.abs(categoryId) % 4;
  switch (rem) {
    case 0:
      return 'bg-brand-soft text-brand-ink';
    case 1:
      return 'bg-ok-soft text-ok';
    case 2:
      return 'bg-warn-soft text-warn';
    case 3:
    default:
      return 'bg-info-soft text-info';
  }
};

const PosProductCard: React.FC<{ product: ProductItem; onAddToCart: (product: ProductItem) => void }> = ({
  product,
  onAddToCart,
}) => {
  const stock = stockOf(product);
  const isOutOfStock = stock <= 0;
  const hasDiscount = Boolean(product.regular_price && Number(product.regular_price) > Number(product.sale_price));
  const stockTone: BadgeTone = isOutOfStock ? 'bad' : stock <= 3 ? 'warn' : 'neutral';

  return (
    <button
      onClick={() => onAddToCart(product)}
      type="button"
      style={{ height: ROW_HEIGHT }}
      className="relative flex flex-col justify-between p-3.5 bg-panel hover:bg-surface-2 active:scale-[0.98] border border-line hover:border-brand-soft rounded-2xl transition-all text-right shadow-xs hover:shadow-md group focus:outline-none focus:ring-2 focus:ring-brand overflow-hidden"
    >
      <div className="flex items-center justify-between gap-1 w-full text-2xs mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-[34px] h-[34px] rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${getCategoryColorClass(
              product.category_id
            )}`}
          >
            {product.name ? product.name.trim().charAt(0) : 'ص'}
          </div>
          <span className="truncate max-w-[80px] bg-surface-2 text-muted px-1.5 py-0.5 rounded-md font-medium">
            {product.code}
          </span>
        </div>
        <Badge tone={stockTone} className="text-2xs px-2 py-0.5 shrink-0">
          {isOutOfStock ? 'نفذ' : `${stock} ${product.unit || 'قطعة'}`}
        </Badge>
      </div>

      <div className="my-1 min-h-0">
        <h4 className="text-xs sm:text-sm font-black text-ink group-hover:text-brand line-clamp-2 leading-tight">
          {product.name}
        </h4>
        <div className="flex flex-wrap items-center gap-1 mt-1">
          {hasDiscount && (
            <Badge tone="bad" className="text-2xs px-1.5 py-0.5 rounded-md font-bold">
              خصم {Math.round(((Number(product.regular_price) - Number(product.sale_price)) / Number(product.regular_price)) * 100)}%
            </Badge>
          )}
          {Boolean(product.has_variants || product.variants?.length) && (
            <Badge tone="info" className="text-2xs px-1.5 py-0.5 rounded-md font-bold">
              {product.variants?.length ? `${product.variants.length} مقاس/لون` : 'متغيرات'}
            </Badge>
          )}
          {Boolean(product.has_expiry || product.batches?.length) && (
            <Badge tone="warn" className="text-2xs px-1.5 py-0.5 rounded-md font-bold">
              صلاحية
            </Badge>
          )}
          {Boolean(product.sub_unit) && (
            <Badge tone="neutral" className="text-2xs px-1.5 py-0.5 rounded-md font-bold">
              {product.sub_unit}
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-line flex items-center justify-between w-full">
        <div className="flex items-baseline gap-1.5 overflow-hidden">
          <span className="text-xs sm:text-sm font-black text-brand">
            {formatCurrency(product.sale_price)}
          </span>
          {hasDiscount && (
            <span className="line-through text-muted text-2xs">
              {formatCurrency(Number(product.regular_price))}
            </span>
          )}
        </div>
        <div className="w-6 h-6 rounded-lg bg-brand-soft text-brand-ink flex items-center justify-center text-xs font-bold group-hover:bg-brand group-hover:text-on-brand transition-colors">
          +
        </div>
      </div>
    </button>
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
  searchInputRef,
  searchQuery,
  setSearchQuery,
  onScanBarcode,
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
  const rowCount = Math.ceil(shownProducts.length / cols);
  const startRow = Math.max(0, Math.floor(metrics.scrollTop / ROW_STRIDE) - 1);
  const visibleRows = Math.ceil(metrics.height / ROW_STRIDE) + 3;
  const endRow = Math.min(rowCount, startRow + visibleRows);
  const slice = shownProducts.slice(startRow * cols, endRow * cols);
  const offset = startRow * ROW_STRIDE;
  const totalHeight = rowCount * ROW_STRIDE;

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
            className="w-full pl-24 pr-11 py-3 bg-panel border border-line rounded-2xl text-sm font-medium text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand shadow-xs transition-all"
          />
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold text-muted bg-surface-2 border border-line rounded-md pointer-events-none">
              F2
            </kbd>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-muted hover:text-ink rounded-lg"
              >
                <X className="w-4 h-4" />
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
              className="absolute inset-x-0 grid gap-3"
              style={{
                top: offset,
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
            >
              {slice.map((product) => (
                <PosProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
              ))}
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
