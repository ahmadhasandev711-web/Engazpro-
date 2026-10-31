import React from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { formatCurrency, StockReportData } from '@pos-mandob/shared';
import { PaginationBar } from '../common/PaginationBar';

interface StockReportTabProps {
  data?: StockReportData;
  isLoading: boolean;
  page?: number;
  onPageChange?: (page: number) => void;
  search?: string;
  onSearchChange?: (search: string) => void;
  isFetching?: boolean;
}

export const StockReportTab: React.FC<StockReportTabProps> = ({
  data,
  isLoading,
  page = 1,
  onPageChange,
  search = '',
  onSearchChange,
  isFetching = false,
}) => {
  if (isLoading) {
    return <div className="text-center py-16 text-sm text-slate-400 font-medium">جاري تقييم المخزون...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-500">إجمالي عدد الأصناف</span>
          <p className="text-2xl font-black text-slate-900 font-mono">
            {data?.summary?.products_count || 0}
          </p>
          <p className="text-[11px] text-slate-400">
            إجمالي {data?.summary?.total_quantity || 0} قطعة بالمخزن
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-500">قيمة المخزون بسعر الشراء (التكلفة)</span>
          <p className="text-2xl font-black text-primary-700" dir="ltr">
            {formatCurrency(data?.summary?.total_cost_value || 0)}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-500">قيمة المخزون بسعر البيع (المتوقع)</span>
          <p className="text-2xl font-black text-emerald-700" dir="ltr">
            {formatCurrency(data?.summary?.total_retail_value || 0)}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-500">أصناف تحت حد الطلب (نواقص)</span>
          <p
            className={`text-2xl font-black font-mono ${
              (data?.summary?.low_stock_count || 0) > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {data?.summary?.low_stock_count || 0}
          </p>
          <p className="text-[11px] text-slate-400">تحتاج إلى إعادة شراء وتوريد</p>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <h3 className="font-bold text-sm text-slate-900">بيان تفصيلي بالمخزون الحالي</h3>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث بالاسم أو الكود..."
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="w-full pl-3 pr-9 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">الصنف</th>
                <th className="py-3 px-4">الكود / الباركود</th>
                <th className="py-3 px-4">الكمية الحالية</th>
                <th className="py-3 px-4">سعر الشراء</th>
                <th className="py-3 px-4">سعر البيع</th>
                <th className="py-3 px-4">إجمالي التكلفة</th>
                <th className="py-3 px-4">إجمالي البيع</th>
                <th className="py-3 px-4 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.products?.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                  <td className="py-3 px-4 text-slate-500 font-mono">{p.code || p.barcode || '—'}</td>
                  <td className="py-3 px-4 font-black font-mono">
                    {p.quantity} {p.unit || ''}
                  </td>
                  <td className="py-3 px-4 font-mono">{formatCurrency(p.purchase_price || 0)}</td>
                  <td className="py-3 px-4 font-mono">{formatCurrency(p.sale_price)}</td>
                  <td className="py-3 px-4 font-bold text-slate-800 font-mono">
                    {formatCurrency(p.cost_value || 0)}
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-700 font-mono">
                    {formatCurrency(p.retail_value)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {p.is_low_stock ? (
                      <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-bold text-2xs">
                        <AlertTriangle className="w-3 h-3" />
                        نواقص
                      </span>
                    ) : (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-2xs">
                        متوفر
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar
          currentPage={data?.pagination?.current_page || data?.meta?.current_page || page}
          lastPage={data?.pagination?.last_page || data?.meta?.last_page || 1}
          total={data?.pagination?.total || data?.meta?.total || data?.products?.length || 0}
          perPage={data?.pagination?.per_page || data?.meta?.per_page || 50}
          onPageChange={(p) => onPageChange?.(p)}
          isFetching={isFetching}
          itemLabel="صنف"
        />
      </div>
    </div>
  );
};
