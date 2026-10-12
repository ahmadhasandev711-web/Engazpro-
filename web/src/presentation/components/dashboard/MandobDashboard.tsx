import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  ShoppingBag,
  CreditCard,
  Clock,
  RefreshCw,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { DashboardData } from './OwnerDashboard';
import { PWAInstallBanner } from '../pwa/PWAInstallBanner';
import { RecentActivityMobileCard } from '../mobile/RecentActivityMobileCard';

interface MandobDashboardProps {
  data: DashboardData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
  userName?: string;
}

export const MandobDashboard: React.FC<MandobDashboardProps> = ({
  data,
  isLoading,
  isFetching,
  refetch,
  userName,
}) => {
  const navigate = useNavigate();
  const kpis = data?.kpis;
  const cashFlow = data?.cash_flow;
  const recentActivities = data?.recent_activities || [];

  return (
    <div className="space-y-6">
      {/* PWA Install Banner */}
      <PWAInstallBanner />

      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900">دفتر المندوب الميداني</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
              {userName || 'مندوب التوزيع'}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
              {data?.today || new Date().toISOString().split('T')[0]}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            متابعة فورية للمبيعات الميدانية، تحصيلات العملاء، ومطابقة العهدة النقدية باليد
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
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>فاتورة جديدة</span>
          </button>
          <button
            onClick={() => navigate('/payments')}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            <span>تحصيل سند قبض</span>
          </button>
        </div>
      </div>

      {/* Mobile Quick Action Buttons (sm:hidden) */}
      <div className="sm:hidden grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate('/sales/new')}
          className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-600 active:bg-primary-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>فاتورة جديدة</span>
        </button>
        <button
          onClick={() => navigate('/payments')}
          className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
        >
          <CreditCard className="w-4 h-4" />
          <span>تحصيل سند قبض</span>
        </button>
      </div>

      {/* Main KPI Cards Grid for Mandob */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* 1. العهدة النقدية الفعلية باليد (Most Important Metric for Mandob) */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-xl border-2 border-amber-400 shadow-sm relative overflow-hidden bg-gradient-to-br from-amber-50/50 to-white">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-black text-amber-900 truncate">العهدة باليد (كاش)</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-amber-800 tracking-tight font-mono">
            {isLoading ? '...' : formatCurrency(kpis?.today_cash_flow ?? 0)}
          </div>
          <div className="text-[10px] sm:text-[11px] font-medium text-amber-700 mt-1 truncate">
            المطلوب تسليمه
          </div>
        </div>

        {/* 2. إجمالي مبيعاتي اليوم (Net Sales) */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">مبيعاتي اليوم</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
            {isLoading ? '...' : formatCurrency(kpis?.today_sales ?? 0)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
            صافي مبيعات اليوم
          </div>
        </div>

        {/* 3. مبيعات آجلة مسجلة اليوم (Credit Sales) */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">مبيعات آجلة</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-indigo-600 tracking-tight font-mono">
            {isLoading ? '...' : formatCurrency(kpis?.today_credit_sales ?? 0)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
            آجل على العملاء
          </div>
        </div>

        {/* 4. مصاريف خط السير المسجلة اليوم */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">مصاريف السير</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-rose-600 tracking-tight font-mono">
            {isLoading ? '...' : formatCurrency(kpis?.today_expenses ?? 0)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
            بنزين ونثريات مخصومة
          </div>
        </div>
      </div>

      {/* Custody Breakdown & Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* تفصيل وتصفية العهدة النقدية اليومية */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-600" />
              <h3 className="font-black text-slate-900 text-base">
                تفصيل وتصفية العهدة النقدية (تقفيل اليومية)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">حسابات دقيقة بدون تداخل</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* المقبوضات النقدية (+) */}
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black text-emerald-800 border-b border-emerald-200/60 pb-2">
                <span className="flex items-center gap-1">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                  مقبوضات كاش دخلت جيب المندوب (+)
                </span>
                <span>{formatCurrency(cashFlow?.inflow.total ?? 0)}</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>مبيعات نقدية محصلة فوراً:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(cashFlow?.inflow.cash_sales ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>تحصيلات سندات قبض من عملاء:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(cashFlow?.inflow.receipt_vouchers ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* المنصرفات النقدية (-) */}
            <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black text-rose-800 border-b border-rose-200/60 pb-2">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4 text-rose-600" />
                  مبالغ خرجت من عهدة المندوب (-)
                </span>
                <span>{formatCurrency(cashFlow?.outflow.total ?? 0)}</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>مرتجعات بيع كاش مردودة للعميل:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(cashFlow?.outflow.sale_returns ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>مصاريف خط السير المسجلة:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(cashFlow?.outflow.expenses ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* الخلاصة الصافية للعهدة */}
          <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-xs font-bold text-slate-200">
                  صافي النقدية باليد المطلوب توريدها للخزينة:
                </div>
                <div className="text-[11px] text-slate-400">
                  (المقبوضات الكاش - المرتجعات الكاش - مصاريف خط السير)
                </div>
              </div>
            </div>
            <span className="text-2xl font-black text-amber-400 tracking-tight">
              {formatCurrency(cashFlow?.net_cash_flow ?? 0)}
            </span>
          </div>
        </div>

        {/* اختصارات المندوب الميداني */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h3 className="font-black text-slate-900 text-base mb-3 flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-600" />
            الوصول السريع
          </h3>

          <button
            onClick={() => navigate('/sales')}
            className="w-full text-right p-3 rounded-lg border border-slate-100 hover:border-amber-200 hover:bg-amber-50/50 flex items-center justify-between transition-all"
          >
            <div>
              <div className="text-xs font-bold text-slate-900">سجل فواتيري</div>
              <div className="text-[11px] text-slate-500">فواتير البيع التي سجلتها اليوم</div>
            </div>
            <span className="text-amber-600 font-bold">&larr;</span>
          </button>

          <button
            onClick={() => navigate('/customers')}
            className="w-full text-right p-3 rounded-lg border border-slate-100 hover:border-amber-200 hover:bg-amber-50/50 flex items-center justify-between transition-all"
          >
            <div>
              <div className="text-xs font-bold text-slate-900">قائمة العملاء وكشف الحساب</div>
              <div className="text-[11px] text-slate-500">مديونيات العملاء وعناوينهم</div>
            </div>
            <span className="text-amber-600 font-bold">&larr;</span>
          </button>

          <button
            onClick={() => navigate('/expenses')}
            className="w-full text-right p-3 rounded-lg border border-slate-100 hover:border-amber-200 hover:bg-amber-50/50 flex items-center justify-between transition-all"
          >
            <div>
              <div className="text-xs font-bold text-slate-900">مصاريف خط السير</div>
              <div className="text-[11px] text-slate-500">تسجيل مصاريف البنزين والنثريات</div>
            </div>
            <span className="text-amber-600 font-bold">&larr;</span>
          </button>

          <button
            onClick={() => navigate('/payments')}
            className="w-full text-right p-3 rounded-lg border border-slate-100 hover:border-amber-200 hover:bg-amber-50/50 flex items-center justify-between transition-all"
          >
            <div>
              <div className="text-xs font-bold text-slate-900">سندات القبض والتحصيل</div>
              <div className="text-[11px] text-slate-500">تسجيل دفعات الديون من العملاء</div>
            </div>
            <span className="text-amber-600 font-bold">&larr;</span>
          </button>
        </div>
      </div>

      {/* جدول آخر حركات المندوب */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-700" />
            <h3 className="font-black text-slate-900 text-base">آخر العمليات التي قمت بتسجيلها</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">أحدث 5 حركات لك</span>
        </div>

        {recentActivities.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            لا توجد حركات مسجلة لك اليوم حتى الآن
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3">نوع الحركة</th>
                    <th className="p-3">المرجع / البيان</th>
                    <th className="p-3">العميل / الحساب</th>
                    <th className="p-3">الوقت</th>
                    <th className="p-3 text-left">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentActivities.map((act, idx) => {
                    let badgeStyle = 'bg-slate-100 text-slate-800';
                    if (act.type === 'SALE') badgeStyle = 'bg-blue-100 text-blue-800';
                    else if (act.type === 'SALE_RETURN') badgeStyle = 'bg-amber-100 text-amber-800';
                    else if (act.type === 'RECEIPT') badgeStyle = 'bg-emerald-100 text-emerald-800';
                    else if (act.type === 'EXPENSE') badgeStyle = 'bg-rose-100 text-rose-800';

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${badgeStyle}`}>
                            {act.type_label}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-900">{act.reference}</td>
                        <td className="p-3 text-slate-600">{act.party_name}</td>
                        <td className="p-3 text-slate-400 font-mono text-[11px]">
                          {act.created_at || act.date}
                        </td>
                        <td className="p-3 text-left font-black text-slate-900 font-mono">
                          {formatCurrency(act.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards View */}
            <div className="md:hidden p-3 space-y-2.5 bg-slate-50/60">
              {recentActivities.map((act) => (
                <RecentActivityMobileCard key={act.id} activity={act} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
