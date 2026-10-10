import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Wallet,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  ShoppingBag,
  CreditCard,
  FileText,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { PWAInstallBanner } from '../pwa/PWAInstallBanner';
import { usePermissions } from '../../../hooks/usePermissions';

export interface DashboardData {
  today: string;
  kpis: {
    today_sales: number;
    today_gross_sales?: number;
    today_cash_sales?: number;
    today_credit_sales?: number;
    today_returns?: number;
    today_profit: number | null;
    today_expenses: number;
    today_cash_flow: number;
    month_sales: number;
  };
  cash_flow: {
    inflow: {
      cash_sales: number;
      electronic_sales?: number;
      receipt_vouchers: number;
      purchase_returns: number;
      total: number;
    };
    outflow: {
      cash_purchases: number;
      payment_vouchers: number;
      sale_returns: number;
      expenses: number;
      total: number;
    };
    net_cash_flow: number;
  };
  recent_activities: Array<{
    id: number;
    category: string;
    type: string;
    type_label: string;
    reference: string;
    party_name: string;
    amount: number;
    date: string;
    created_at: string;
    created_by_name?: string | null;
    created_by_role?: string | null;
  }>;
}

interface OwnerDashboardProps {
  data: DashboardData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  data,
  isLoading,
  isFetching,
  refetch,
}) => {
  const navigate = useNavigate();
  const { isManager, canViewProfitReport } = usePermissions();
  const kpis = data?.kpis;
  const showProfitCard = canViewProfitReport && kpis?.today_profit !== null && kpis?.today_profit !== undefined;
  const cashFlow = data?.cash_flow;
  const recentActivities = data?.recent_activities || [];

  return (
    <div className="space-y-6">
      {/* PWA Install Banner */}
      <PWAInstallBanner />

      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span>لوحة المتابعة الشاملة</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary-100 text-primary-800">
              {data?.today || new Date().toISOString().split('T')[0]}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isManager
              ? 'ملخص فوري لمبيعات وحصيلة اليوم النقدية ومصروفات الفرع'
              : 'ملخص فوري لمبيعات وأرباح وحصيلة اليوم النقدية الصافية للمتجر'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-primary-600' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/sales/new')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>فاتورة جديدة</span>
          </button>
          <button
            onClick={() => navigate('/payments')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            <span>سند قبض / صرف</span>
          </button>
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${showProfitCard ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        {/* 1. مبيعات اليوم الصافية */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">
              {isManager ? 'مبيعات الفرع الصافية اليوم' : 'مبيعات اليوم الصافية'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {isLoading ? '...' : formatCurrency(kpis?.today_sales ?? 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span>مبيعات الشهر:</span>
            <span className="font-bold text-slate-600">{formatCurrency(kpis?.month_sales ?? 0)}</span>
          </div>
        </div>

        {/* 2. صافي أرباح اليوم - للمالك ومدير النظام فقط */}
        {showProfitCard && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">صافي أرباح اليوم</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 tracking-tight">
              {isLoading ? '...' : formatCurrency(kpis?.today_profit ?? 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              بعد خصم تكلفة البضاعة ومصروفات اليوم
            </div>
          </div>
        )}

        {/* 3. الحصيلة النقدية الصافية لليوم (Cash Flow) */}
        <div className="bg-white p-5 rounded-xl border-2 border-amber-400 shadow-sm relative overflow-hidden bg-gradient-to-br from-amber-50/40 to-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-amber-900">حصيلة اليوم النقدية (الخزينة)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-800 tracking-tight">
            {isLoading ? '...' : formatCurrency(kpis?.today_cash_flow ?? 0)}
          </div>
          <div className="text-[11px] font-medium text-amber-700 mt-1">
            المبلغ الفعلي الصافي بالخزينة
          </div>
        </div>

        {/* 4. مصروفات اليوم */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">مصروفات اليوم</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 tracking-tight">
            {isLoading ? '...' : formatCurrency(kpis?.today_expenses ?? 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            إجمالي المصروفات المنصرفة اليوم
          </div>
        </div>
      </div>

      {/* Cash Flow Breakdown & Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* تفصيل حركة النقدية لليوم */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-600" />
              <h3 className="font-black text-slate-900 text-base">
                {isManager ? 'تفصيل حركة النقدية لليوم (خزينة الفرع)' : 'تفصيل حركة النقدية لليوم (الخزينة العامة)'}
              </h3>
            </div>
            <button
              onClick={() => navigate('/reports')}
              className="text-xs font-bold text-primary-600 hover:text-primary-800 hover:underline"
            >
              عرض تقرير الخزينة المفصل &larr;
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* الداخل (Inflow) */}
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black text-emerald-800 border-b border-emerald-200/60 pb-2">
                <span className="flex items-center gap-1">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                  المقبوضات النقدية الداخلة (+)
                </span>
                <span>{formatCurrency(cashFlow?.inflow.total ?? 0)}</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>مبيعات نقدية:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(cashFlow?.inflow.cash_sales ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>سندات قبض من عملاء:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(cashFlow?.inflow.receipt_vouchers ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>مرتجعات شراء مستردة:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(cashFlow?.inflow.purchase_returns ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* الخارج (Outflow) */}
            <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black text-rose-800 border-b border-rose-200/60 pb-2">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4 text-rose-600" />
                  المدفوعات النقدية الخارجة (-)
                </span>
                <span>{formatCurrency(cashFlow?.outflow.total ?? 0)}</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>مشتريات نقدية:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(cashFlow?.outflow.cash_purchases ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>سندات صرف لموردين:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(cashFlow?.outflow.payment_vouchers ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>مرتجعات بيع مردودة للعملاء:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(cashFlow?.outflow.sale_returns ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>مصروفات اليوم:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(cashFlow?.outflow.expenses ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* الخلاصة الصافية */}
          <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold">صافي النقدية الفعلية لليوم (الداخل - الخارج):</span>
            <span className="text-lg font-black text-amber-400">
              {formatCurrency(cashFlow?.net_cash_flow ?? 0)}
            </span>
          </div>
        </div>

        {/* روابط سريعة */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h3 className="font-black text-slate-900 text-base mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-700" />
            روابط وتقارير سريعة
          </h3>

          <button
            onClick={() => navigate('/sales')}
            className="w-full text-right p-3 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/50 flex items-center justify-between transition-all"
          >
            <div>
              <div className="text-xs font-bold text-slate-900">سجل فواتير البيع</div>
              <div className="text-[11px] text-slate-500">متابعة الفواتير والتحصيلات</div>
            </div>
            <span className="text-primary-600 font-bold">&larr;</span>
          </button>

          <button
            onClick={() => navigate('/customers')}
            className="w-full text-right p-3 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/50 flex items-center justify-between transition-all"
          >
            <div>
              <div className="text-xs font-bold text-slate-900">العملاء (كشف الحساب)</div>
              <div className="text-[11px] text-slate-500">متابعة المديونيات والأرصدة</div>
            </div>
            <span className="text-primary-600 font-bold">&larr;</span>
          </button>

          {canViewProfitReport ? (
            <button
              onClick={() => navigate('/reports')}
              className="w-full text-right p-3 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/50 flex items-center justify-between transition-all"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">تقارير الأرباح والمخزون</div>
                <div className="text-[11px] text-slate-500">حسابات الأرباح والنواقص</div>
              </div>
              <span className="text-primary-600 font-bold">&larr;</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/reports')}
              className="w-full text-right p-3 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/50 flex items-center justify-between transition-all"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">تقارير حركة ومبيعات الفرع</div>
                <div className="text-[11px] text-slate-500">متابعة المبيعات وحركات الخزينة والمخزون</div>
              </div>
              <span className="text-primary-600 font-bold">&larr;</span>
            </button>
          )}

          <button
            onClick={() => navigate('/expenses')}
            className="w-full text-right p-3 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/50 flex items-center justify-between transition-all"
          >
            <div>
              <div className="text-xs font-bold text-slate-900">سجل المصروفات</div>
              <div className="text-[11px] text-slate-500">تسجيل وتصنيف المصاريف اليومية</div>
            </div>
            <span className="text-primary-600 font-bold">&larr;</span>
          </button>
        </div>
      </div>

      {/* جدول آخر 5 حركات مسجلة */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-700" />
            <h3 className="font-black text-slate-900 text-base">آخر الحركات المسجلة في النظام</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">أحدث 5 عمليات</span>
        </div>

        {recentActivities.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            لا توجد حركات مسجلة بعد في النظام
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3">نوع الحركة</th>
                  <th className="p-3">المرجع / البيان</th>
                  <th className="p-3">الطرف / الحساب</th>
                  <th className="p-3">المسؤول / المنشئ</th>
                  <th className="p-3">التاريخ والوقت</th>
                  <th className="p-3 text-left">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentActivities.map((act, idx) => {
                  let badgeStyle = 'bg-slate-100 text-slate-800';
                  if (act.type === 'SALE') badgeStyle = 'bg-blue-100 text-blue-800';
                  else if (act.type === 'PURCHASE') badgeStyle = 'bg-purple-100 text-purple-800';
                  else if (act.type === 'SALE_RETURN' || act.type === 'PURCHASE_RETURN')
                    badgeStyle = 'bg-amber-100 text-amber-800';
                  else if (act.type === 'RECEIPT') badgeStyle = 'bg-emerald-100 text-emerald-800';
                  else if (act.type === 'PAYMENT' || act.type === 'EXPENSE')
                    badgeStyle = 'bg-rose-100 text-rose-800';

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${badgeStyle}`}>
                          {act.type_label}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900">{act.reference}</td>
                      <td className="p-3 text-slate-600">{act.party_name}</td>
                      <td className="p-3">
                        {act.created_by_name ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{act.created_by_name}</span>
                            <span className="text-[10px] text-slate-500">
                              {act.created_by_role === 'MANDOB' ? 'مندوب مبيعات' :
                               act.created_by_role === 'CASHIER' ? 'كاشير' :
                               act.created_by_role === 'MANAGER' ? 'مدير' :
                               act.created_by_role === 'SUPERVISOR' ? 'مشرف' : 'المالك'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">المالك</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400 font-mono text-[11px]">
                        {act.created_at || act.date}
                      </td>
                      <td className="p-3 text-left font-black text-slate-900">
                        {formatCurrency(act.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
