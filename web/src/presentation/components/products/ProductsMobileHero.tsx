import React from 'react';
import { formatNumber } from '@pos-mandob/shared';
import { Package, Plus, Boxes } from 'lucide-react';
import type { ProductsViewModel } from './types';

export const ProductsMobileHero: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const { setIsOpeningStockOpen, isMandob, canAddProduct, openCreateModal, totalProducts, totalStock, lowStockCount } = vm;

  return (
    <>
      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className="md:hidden bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-slate-900 truncate">
                {isMandob ? 'الأصناف والأسعار' : 'الأصناف والمخزون'}
              </h2>
              <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                {totalProducts}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              المخزون: <span className="font-bold text-slate-800">{formatNumber(totalStock)}</span>
              {lowStockCount > 0 && (
                <span className="text-amber-600 font-black mr-1.5 inline-flex items-center gap-0.5">
                  • {lowStockCount} نواقص
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {canAddProduct && (
            <button
              onClick={() => setIsOpeningStockOpen(true)}
              className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-2 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
              title="رصيد أول المدة"
            >
              <Boxes className="w-3.5 h-3.5 text-primary-600" />
              <span>أول المدة</span>
            </button>
          )}
          {canAddProduct && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1 bg-primary-600 active:bg-primary-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة</span>
            </button>
          )}
        </div>
      </div>

    </>
  );
};
