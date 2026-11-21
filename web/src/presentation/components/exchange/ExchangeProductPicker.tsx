import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@pos-mandob/shared';
import { Search, Plus, Package } from 'lucide-react';
import { apiClient } from '../../../data/api/client';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

export interface SelectedExchangeVariantItem {
  product_id: number;
  product_variant_id?: number | null;
  product_name: string;
  variant_name?: string | null;
  unit_price: number;
  quantity: number;
  max_stock?: number;
}

interface ExchangeProductPickerProps {
  branchId?: number | null;
  onAdd: (item: SelectedExchangeVariantItem) => void;
  title?: string;
}

export const ExchangeProductPicker: React.FC<ExchangeProductPickerProps> = ({
  branchId,
  onAdd,
  title = 'إضافة قطعة بديلة (اختر المقاس/اللون)',
}) => {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 350);

  const { data: products = [], isFetching } = useQuery<any[]>({
    queryKey: ['exchange-catalog', branchId, debounced],
    queryFn: async () => {
      const res = await apiClient.get('/products/pos-catalog', {
        params: {
          per_page: 12,
          branch_id: branchId || undefined,
          search: debounced || undefined,
        },
      });
      return res.data?.data || [];
    },
  });

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black text-ink flex items-center gap-1.5">
          <Package className="w-4 h-4 text-brand" />
          {title}
        </span>
        {isFetching && <span className="text-[11px] text-muted font-bold">جاري التحميل...</span>}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم الصنف أو الكود أو الباركود..."
          className="w-full min-h-[40px] pr-9 pl-3 bg-panel border border-line rounded-xl text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div className="max-h-56 overflow-y-auto space-y-2 pr-0.5">
        {products.map((product) => {
          const variants = Array.isArray(product.variants) && product.variants.length > 0 ? product.variants : null;

          if (variants) {
            return (
              <div key={product.id} className="p-2.5 rounded-xl border border-line bg-surface-2/60 space-y-1.5">
                <div className="text-xs font-black text-ink">{product.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  {variants.map((v: any) => {
                    const price = Number(v.selling_price ?? v.sale_price ?? product.selling_price ?? 0);
                    const stock = Number(v.branch_quantity ?? v.quantity ?? 0);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() =>
                          onAdd({
                            product_id: product.id,
                            product_variant_id: v.id,
                            product_name: product.name,
                            variant_name: v.name,
                            unit_price: price,
                            quantity: 1,
                            max_stock: stock,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-panel border border-line hover:border-brand hover:bg-brand-soft/40 text-right transition-colors text-[11px] flex items-center gap-1.5"
                      >
                        <Plus className="w-3 h-3 text-brand shrink-0" />
                        <span className="font-bold text-ink">{v.name}</span>
                        <span className="text-brand font-black tabular-nums">{formatCurrency(price)}</span>
                        <span className="text-muted tabular-nums">({stock})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          const basePrice = Number(product.selling_price ?? product.sale_price ?? 0);
          return (
            <button
              key={product.id}
              type="button"
              onClick={() =>
                onAdd({
                  product_id: product.id,
                  product_variant_id: null,
                  product_name: product.name,
                  variant_name: null,
                  unit_price: basePrice,
                  quantity: 1,
                  max_stock: Number(product.branch_quantity ?? product.quantity ?? 0),
                })
              }
              className="w-full p-2.5 rounded-xl border border-line bg-panel hover:border-brand text-right flex items-center justify-between gap-2 transition-colors text-xs"
            >
              <span className="font-bold text-ink">{product.name}</span>
              <span className="font-black text-brand tabular-nums flex items-center gap-1">
                {formatCurrency(basePrice)}
                <Plus className="w-3.5 h-3.5" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
