import React from 'react';
import { formatCurrency, SalesReportData } from '@pos-mandob/shared';

interface SalesReportTabProps {
  data?: SalesReportData;
  isLoading: boolean;
}

export const SalesReportTab: React.FC<SalesReportTabProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return <div className="text-center py-16 text-sm text-slate-400 font-medium">جاري تحميل حركات المبيعات...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-500">إجمالي المبيعات</span>
          <p className="text-2xl font-black text-emerald-700" dir="ltr">
            {formatCurrency(data?.total_sales || 0)}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-500">إجمالي المشتريات</span>
          <p className="text-2xl font-black text-indigo-700" dir="ltr">
            {formatCurrency(data?.total_purchases || 0)}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-500">المحصل نقدياً من المبيعات</span>
          <p className="text-2xl font-black text-slate-900" dir="ltr">
            {formatCurrency(data?.sales_paid || 0)}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-500">المتبقي آجل على العملاء</span>
          <p className="text-2xl font-black text-rose-700" dir="ltr">
            {formatCurrency(data?.sales_remaining || 0)}
          </p>
        </div>
      </div>

      {/* Payment Methods Breakdown */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900">توزيع المبيعات حسب طريقة الدفع</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {data?.payment_methods?.map((pm) => (
            <div key={pm.payment_method} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs font-bold text-slate-600">
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
              <p className="text-lg font-black text-slate-900 mt-1 font-mono">
                {formatCurrency(pm.total_amount)}
              </p>
              <p className="text-[11px] text-slate-400">{pm.count} فواتير</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
