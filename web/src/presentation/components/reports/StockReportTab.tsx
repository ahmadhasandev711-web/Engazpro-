import React from 'react';
import { AlertTriangle, Package, Search } from 'lucide-react';
import { formatCurrency, StockReportData } from '@pos-mandob/shared';
import { PaginationBar } from '../common/PaginationBar';
import { Badge, Card, DataTable, EmptyState, Input, StatCard } from '../ui';

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
    return (
      <div className="text-center py-16 text-sm text-muted font-medium">جاري تقييم المخزون...</div>
    );
  }

  const products = data?.products || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي عدد الأصناف"
          value={data?.summary?.products_count || 0}
          tone="neutral"
          hint={`إجمالي ${data?.summary?.total_quantity || 0} قطعة بالمخزن`}
        />

        <StatCard
          label="قيمة المخزون بسعر الشراء (التكلفة)"
          value={<span dir="ltr">{formatCurrency(data?.summary?.total_cost_value || 0)}</span>}
          tone="brand"
        />

        <StatCard
          label="قيمة المخزون بسعر البيع (المتوقع)"
          value={<span dir="ltr">{formatCurrency(data?.summary?.total_retail_value || 0)}</span>}
          tone="ok"
        />

        <StatCard
          label="أصناف تحت حد الطلب (نواقص)"
          value={data?.summary?.low_stock_count || 0}
          tone={(data?.summary?.low_stock_count || 0) > 0 ? 'bad' : 'neutral'}
          hint="تحتاج إلى إعادة شراء وتوريد"
        />
      </div>

      {/* Stock Table */}
      <Card className="p-0 sm:p-0 overflow-hidden">
        <div className="p-4 border-b border-line flex flex-col sm:flex-row items-center justify-between gap-3">
          <h3 className="font-bold text-sm text-ink">بيان تفصيلي بالمخزون الحالي</h3>
          <div className="w-full sm:w-64">
            <Input
              type="text"
              placeholder="بحث بالاسم أو الكود..."
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              className="bg-surface-2/60 text-xs"
            />
          </div>
        </div>
        {products.length === 0 ? (
          <EmptyState
            icon={<Package className="w-6 h-6" />}
            title="لا توجد أصناف مطابقة"
            description="جرّب تغيير عبارة البحث لعرض أصناف المخزون."
            className="border-0 rounded-none py-12"
          />
        ) : (
          <DataTable className="border-0 rounded-none shadow-none">
            <thead className="bg-surface-2 text-muted font-bold border-b border-line text-xs">
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
            <tbody className="divide-y divide-line text-xs">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2/70 transition-colors">
                  <td className="py-3 px-4 font-bold text-ink">{p.name}</td>
                  <td className="py-3 px-4 text-muted tabular-nums">{p.code || p.barcode || '—'}</td>
                  <td className="py-3 px-4 font-black text-ink tabular-nums">
                    {p.quantity} {p.unit || ''}
                  </td>
                  <td className="py-3 px-4 tabular-nums text-ink">
                    {formatCurrency(p.purchase_price || 0)}
                  </td>
                  <td className="py-3 px-4 tabular-nums text-ink">{formatCurrency(p.sale_price)}</td>
                  <td className="py-3 px-4 font-bold text-ink tabular-nums">
                    {formatCurrency(p.cost_value || 0)}
                  </td>
                  <td className="py-3 px-4 font-bold text-ok tabular-nums">
                    {formatCurrency(p.retail_value)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {p.is_low_stock ? (
                      <Badge tone="bad" className="text-[11px]">
                        <AlertTriangle className="w-3 h-3" />
                        نواقص
                      </Badge>
                    ) : (
                      <Badge tone="ok" className="text-[11px]">
                        متوفر
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        <PaginationBar
          currentPage={data?.pagination?.current_page || data?.meta?.current_page || page}
          lastPage={data?.pagination?.last_page || data?.meta?.last_page || 1}
          total={data?.pagination?.total || data?.meta?.total || products.length || 0}
          perPage={data?.pagination?.per_page || data?.meta?.per_page || 50}
          onPageChange={(p) => onPageChange?.(p)}
          isFetching={isFetching}
          itemLabel="صنف"
        />
      </Card>
    </div>
  );
};
