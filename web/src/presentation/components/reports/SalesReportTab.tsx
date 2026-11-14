import React from 'react';
import { formatCurrency, SalesReportData } from '@pos-mandob/shared';
import { Card, StatCard } from '../ui';

interface SalesReportTabProps {
  data?: SalesReportData;
  isLoading: boolean;
}

export const SalesReportTab: React.FC<SalesReportTabProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="text-center py-16 text-sm text-muted font-medium">
        جاري تحميل حركات المبيعات...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي المبيعات"
          value={<span dir="ltr">{formatCurrency(data?.total_sales || 0)}</span>}
          tone="ok"
        />
        <StatCard
          label="إجمالي المشتريات"
          value={<span dir="ltr">{formatCurrency(data?.total_purchases || 0)}</span>}
          tone="info"
        />
        <StatCard
          label="المحصل نقدياً من المبيعات"
          value={<span dir="ltr">{formatCurrency(data?.sales_paid || 0)}</span>}
          tone="neutral"
        />
        <StatCard
          label="المتبقي آجل على العملاء"
          value={<span dir="ltr">{formatCurrency(data?.sales_remaining || 0)}</span>}
          tone="bad"
        />
      </div>

      {/* Payment Methods Breakdown */}
      <Card className="p-6 space-y-4">
        <h3 className="font-bold text-sm text-ink">توزيع المبيعات حسب طريقة الدفع</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {data?.payment_methods?.map((pm) => (
            <div
              key={pm.payment_method}
              className="p-4 bg-surface-2 rounded-xl border border-line"
            >
              <p className="text-xs font-bold text-muted">
                {pm.payment_method === 'CASH'
                  ? 'نقدي (كاش)'
                  : pm.payment_method === 'CARD'
                    ? 'فيزا / بطاقة'
                    : pm.payment_method === 'INSTAPAY'
                      ? 'إنستاباي'
                      : pm.payment_method === 'VODAFONE_CASH'
                        ? 'فودافون كاش'
                        : pm.payment_method === 'SPLIT'
                          ? 'دفع مجزأ'
                          : pm.payment_method === 'TRANSFER'
                            ? 'تحويل بنكي'
                            : 'آجل (على الحساب)'}
              </p>
              <p className="text-lg font-black text-ink mt-1 tabular-nums">
                {formatCurrency(pm.total_amount)}
              </p>
              <p className="text-[11px] text-muted tabular-nums">{pm.count} فواتير</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
