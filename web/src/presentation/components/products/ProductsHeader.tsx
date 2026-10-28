import React from 'react';
import { exportProductsToExcel } from '../../utils/excelExport';
import { Plus, Download, Upload, Boxes } from 'lucide-react';
import type { ProductsViewModel } from './types';

export const ProductsHeader: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const { setIsOpeningStockOpen, isMandob, canAddProduct, canImportProducts, navigate, products, openCreateModal } = vm;

  return (
    <>
      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isMandob ? 'الأصناف والأسعار' : 'الأصناف والمخزون المتقدم'}
          </h2>
          <p className="text-sm text-slate-500">
            {isMandob
              ? 'استعراض المنتجات، أسعار البيع، والكميات المتوفرة بالمخزن'
              : 'إدارة المنتجات، المقاسات والألوان، تواريخ الصلاحية، والوحدات المتعددة'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportProductsToExcel(products)}
            disabled={products.length === 0}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            title="تصدير الأصناف والمخزون الحالي إلى Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            تصدير Excel
          </button>
          {canImportProducts && (
            <button
              onClick={() => navigate('/excel')}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors"
              title="استيراد أصناف من ملف Excel"
            >
              <Upload className="w-4 h-4 text-primary-600" />
              استيراد Excel
            </button>
          )}
          {canAddProduct && (
            <button
              onClick={() => setIsOpeningStockOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors"
              title="إدخال رصيد أول المدة للأصناف والمتغيرات بدون فواتير"
            >
              <Boxes className="w-4 h-4 text-primary-600" />
              رصيد أول المدة
            </button>
          )}
          {canAddProduct && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              إضافة صنف جديد
            </button>
          )}
        </div>
      </div>

    </>
  );
};
