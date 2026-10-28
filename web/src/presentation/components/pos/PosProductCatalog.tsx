import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Package, X } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';

export interface ProductItem {
  id: number;
  name: string;
  code: string;
  barcode?: string;
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

const PosProductCard: React.FC<{ product: ProductItem; onAddToCart: (product: ProductItem) => void }> = ({
  product,
  onAddToCart,
}) => {
  const stock = stockOf(product);
  const isOutOfStock = stock <= 0;
  const hasDiscount = Boolean(product.regular_price && Number(product.regular_price) > Number(product.sale_price));

  return (
    <button
      onClick={() => onAddToCart(product)}
      type="button"
      style={{ height: ROW_HEIGHT }}
      className="relative flex flex-col justify-between p-3.5 bg-white hover:bg-emerald-50/50 active:scale-[0.98] border border-slate-200 hover:border-emerald-300 rounded-2xl transition-all text-right shadow-xs hover:shadow-md group focus:outline-none focus:ring-2 focus:ring-primary-500 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-1 w-full text-[10px] text-slate-400 mb-2">
        <span className="font-mono truncate max-w-[80px] bg-slate-100 px-1.5 py-0.5 rounded-md">
          {product.code}
        </span>
        <span
          className={`px-2 py-0.5 rounded-full font-mono font-bold ${
            isOutOfStock
              ? 'bg-rose-100 text-rose-700'
              : stock <= 5
              ? 'bg-amber-100 text-amber-800'
              : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {isOutOfStock ? 'نفذ' : `${stock} ${product.unit || 'قطعة'}`}
        </span>
      </div>
      <div className="my-1 min-h-0">
        <h4 className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-emerald-700 line-clamp-2 leading-tight">
          {product.name}
        </h4>
        <div className="flex flex-wrap items-center gap-1 mt-1">
          {hasDiscount && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-rose-50 text-rose-600 font-bold border border-rose-100">
              خصم {Math.round(((Number(product.regular_price) - Number(product.sale_price)) / Number(product.regular_price)) * 100)}%
            </span>
          )}
          {Boolean(product.has_variants || product.variants?.length) && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
              {product.variants?.length ? `${product.variants.length} مقاس/لون` : 'متغيرات'}
            </span>
          )}
          {Boolean(product.has_expiry || product.batches?.length) && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 font-bold border border-amber-100">
              صلاحية
            </span>
          )}
          {Boolean(product.sub_unit) && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-700 font-bold border border-sky-100">
              {product.sub_unit}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between w-full">
        <div className="flex items-baseline gap-1.5 overflow-hidden">
          <span className="text-xs sm:text-sm font-black text-emerald-600 font-mono">
            {formatCurrency(product.sale_price)}
          </span>
          {hasDiscount && (
            <span className="line-through text-slate-400 text-[10px] font-mono">
              {formatCurrency(Number(product.regular_price))}
            </span>
          )}
        </div>
        <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold group-hover:bg-emerald-600 group-hover:text-white transition-colors">
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
      className="flex flex-col h-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
      data-pos-rendered={slice.length}
      data-pos-loaded={shownProducts.length}
      data-pos-search-ms={searchMs ?? undefined}
    >
      <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
        <div className="relative">
          <Search className="w-5 h-5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
            className="w-full pl-24 pr-11 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm transition-all"
          />
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded-md pointer-events-none">
              F2
            </kbd>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
            <button
              onClick={() => onSelectCategory(null)}
              className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedCategoryId === null
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              جميع الأصناف{browseTotal !== null ? ` (${browseTotal})` : ''}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => onSelectCategory(category.id)}
                className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  selectedCategoryId === category.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
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
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            جاري تحميل كتالوج الأصناف...
          </div>
        ) : shownProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-3">
              <Package className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">
              {isSearching ? 'جاري البحث في كل الأصناف...' : 'لا يوجد صنف يطابق هذا البحث'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              {isSearching
                ? 'البحث يتم على الكتالوج كامل، مش على الصفحة الظاهرة فقط.'
                : 'تأكد من كتابة الاسم أو الباركود بشكل صحيح، أو أضف الصنف لقائمة المنتجات أولاً.'}
            </p>
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
          <p className="text-center text-[11px] text-slate-400 py-3">جاري تحميل المزيد...</p>
        )}
        {!isLoading && searchQuery.trim() && totalCount > shownProducts.length && isSearching && (
          <p className="text-center text-[11px] text-slate-400 py-2">نتائج البحث: {totalCount}</p>
        )}
      </div>
    </div>
  );
};
