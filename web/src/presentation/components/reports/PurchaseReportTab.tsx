import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Truck, ExternalLink } from 'lucide-react';
import { formatCurrency, PurchaseReportData } from '@pos-mandob/shared';
import { Badge, Card, EmptyState, StatCard } from '../ui';

interface PurchaseReportTabProps {
  data?: PurchaseReportData;
  isLoading: boolean;
}

export const PurchaseReportTab: React.FC<PurchaseReportTabProps> = ({ data, isLoading }) => {
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="text-center py-16 text-sm text-muted font-medium">جاري تجميع بيانات المشتريات والموردين...</div>;
  }

  const s = data?.summary;
  const suppliers = data?.top_suppliers || [];
  const products = data?.top_products || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="صافي المشتريات"
          value={<span dir="ltr">{formatCurrency(s?.net_purchases || 0)}</span>}
          tone="brand"
          hint={`إجمالي ${s?.total_purchases ? formatCurrency(s.total_purchases) : '0'} − مرتجعات ${formatCurrency(s?.total_purchase_returns || 0)}`}
        />
        <StatCard
          label="المشتريات النقدية (كاش)"
          value={<span dir="ltr">{formatCurrency(s?.cash_purchases || 0)}</span>}
          tone="ok"
          hint={`إجمالي المسدد: ${formatCurrency(s?.total_paid || 0)}`}
        />
        <StatCard
          label="المشتريات الآجلة"
          value={<span dir="ltr">{formatCurrency(s?.credit_purchases || 0)}</span>}
          tone={(s?.total_remaining || 0) > 0 ? 'warn' : 'neutral'}
          hint={`المتبقي غير المسدد: ${formatCurrency(s?.total_remaining || 0)}`}
        />
        <StatCard
          label="عدد فواتير المشتريات"
          value={s?.invoices_count || 0}
          tone="neutral"
          hint={`مرتجعات الشراء: ${s?.returns_count || 0} فاتورة`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-ink flex items-center gap-2">
              <Truck className="w-4 h-4 text-brand" /> الموردون الأكثر تعاملاً
            </h3>
            <Badge tone="neutral">{suppliers.length} مورد</Badge>
          </div>
          {suppliers.length === 0 ? (
            <EmptyState icon={<Truck className="w-6 h-6 text-muted" />} title="لا توجد فواتير شراء مسجلة لموردين في هذه الفترة" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className="py-2 px-2">المورد</th>
                    <th className="py-2 px-2 text-center">الفواتير</th>
                    <th className="py-2 px-2">إجمالي الشراء</th>
                    <th className="py-2 px-2">الرصيد الحالي</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((sup) => (
                    <tr key={sup.party_id} className="border-b border-line/60 hover:bg-surface-2/40">
                      <td className="py-2.5 px-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/ledger/${sup.party_id}`)}
                          className="font-bold text-ink hover:text-brand inline-flex items-center gap-1"
                        >
                          {sup.supplier_name} <ExternalLink className="w-3 h-3 text-muted" />
                        </button>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono">{sup.invoices_count}</td>
                      <td className="py-2.5 px-2 font-mono font-bold text-ink" dir="ltr">{formatCurrency(sup.total_amount)}</td>
                      <td className="py-2.5 px-2 font-mono" dir="ltr">
                        <Badge tone={sup.current_balance < 0 ? 'warn' : 'neutral'}>{formatCurrency(Math.abs(sup.current_balance))}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-ink flex items-center gap-2">
              <Package className="w-4 h-4 text-brand" /> أكثر الأصناف شراءً
            </h3>
            <Badge tone="neutral">{products.length} صنف</Badge>
          </div>
          {products.length === 0 ? (
            <EmptyState icon={<Package className="w-6 h-6 text-muted" />} title="لا توجد بنود مشتريات في هذه الفترة" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className="py-2 px-2">الصنف</th>
                    <th className="py-2 px-2 text-center">الكمية</th>
                    <th className="py-2 px-2">متوسط التكلفة</th>
                    <th className="py-2 px-2">إجمالي التكلفة</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((prod) => (
                    <tr key={prod.product_id} className="border-b border-line/60 hover:bg-surface-2/40">
                      <td className="py-2.5 px-2 font-bold text-ink">{prod.product_name}</td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold">{prod.total_quantity}</td>
                      <td className="py-2.5 px-2 font-mono text-muted" dir="ltr">{formatCurrency(prod.avg_unit_cost)}</td>
                      <td className="py-2.5 px-2 font-mono font-bold text-brand-ink" dir="ltr">{formatCurrency(prod.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
