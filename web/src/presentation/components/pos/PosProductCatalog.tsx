import React, { useState, useMemo } from 'react';
import { Search, Package, X, Camera } from 'lucide-react';
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

interface PosProductCatalogProps {
  products: ProductItem[];
  isLoading: boolean;
  onAddToCart: (product: ProductItem) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onScanBarcode?: (barcode: string) => boolean;
  onOpenMobileScanner?: () => void;
}

export const PosProductCatalog: React.FC<PosProductCatalogProps> = ({
  products,
  isLoading,
  onAddToCart,
  searchInputRef,
  searchQuery,
  setSearchQuery,
  onScanBarcode,
  onOpenMobileScanner,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Extract unique categories from products list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category_name) {
        set.add(p.category_name);
      }
    });
    return Array.from(set);
  }, [products]);

  // Filter products by search query and category
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'ALL' || p.category_name === selectedCategory;
      const matchesSearch =
        !q ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [products, searchQuery, selectedCategory]);

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Top Search Bar & Category Chips */}
      <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
        {/* Search Bar */}
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
                if (onScanBarcode && onScanBarcode(searchQuery.trim())) {
                  setSearchQuery('');
                }
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
            {onOpenMobileScanner && (
              <button
                type="button"
                onClick={onOpenMobileScanner}
                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="مسح الباركود بكاميرا الهاتف"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Categories Bar */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              جميع الأصناف ({products.length})
            </button>

            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto p-4 pb-28 lg:pb-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            جاري تحميل كتالوج الأصناف...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-3">
              <Package className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">لا يوجد صنف يطابق هذا البحث</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              تأكد من كتابة الاسم أو الباركود بشكل صحيح، أو أضف الصنف لقائمة المنتجات أولاً.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((product) => {
              const hasVariants = Boolean(product.has_variants || product.variants?.length);
              const variantStockSum = product.variants?.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0) ?? 0;
              const stock = hasVariants ? (product.variants?.length ? variantStockSum : (product.quantity ?? 0)) : (product.quantity ?? 0);
              const isOutOfStock = stock <= 0;

              return (
                <button
                  key={product.id}
                  onClick={() => onAddToCart(product)}
                  type="button"
                  className="relative flex flex-col justify-between p-3.5 bg-white hover:bg-emerald-50/50 active:scale-[0.98] border border-slate-200 hover:border-emerald-300 rounded-2xl transition-all text-right shadow-xs hover:shadow-md group focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {/* Top Item Code & Stock Badge */}
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

                  {/* Product Name & Badges */}
                  <div className="my-1">
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-emerald-700 line-clamp-2 leading-tight">
                      {product.name}
                    </h4>

                    {/* Metadata tags */}
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {Boolean(product.regular_price && Number(product.regular_price) > Number(product.sale_price)) && (
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

                  {/* Price & Touch Action */}
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between w-full">
                    <div className="flex items-baseline gap-1.5 overflow-hidden">
                      <span className="text-xs sm:text-sm font-black text-emerald-600 font-mono">
                        {formatCurrency(product.sale_price)}
                      </span>
                      {Boolean(product.regular_price && Number(product.regular_price) > Number(product.sale_price)) && (
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
            })}
          </div>
        )}
      </div>
    </div>
  );
};
