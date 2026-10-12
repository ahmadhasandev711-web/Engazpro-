import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingBag,
  CreditCard,
  Clock,
  RefreshCw,
  Store,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { DashboardData } from './OwnerDashboard';
import { PWAInstallBanner } from '../pwa/PWAInstallBanner';
import { RecentActivityMobileCard } from '../mobile/RecentActivityMobileCard';

interface CashierDashboardProps {
  data: DashboardData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
  userName?: string;
}

export const CashierDashboard: React.FC<CashierDashboardProps> = ({
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
            <h2 className="text-xl font-black text-slate-900">وردية الكاشير (POS)</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
              {userName || 'كاشير المتجر'}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
              {data?.today || new Date().toISOString().split('T')[0]}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            متابعة فورية لمبيعات الوردية، نقدية الدرج، ومصروفات النثريات اليومية
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
            onClick={() => navigate('/pos')}
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-700/20 transition-all"
          >
            <Store className="w-4 h-4" />
            <span>⚡ فتح شاشة البيع السريعة (POS)</span>
          </button>
          <button
            onClick={() => navigate('/expenses')}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
          >
            <Receipt className="w-4 h-4" />
            <span>تسجيل مصروف درج</span>
          </button>
        </div>
      </div>

      {/* Mobile Quick Action Buttons (sm:hidden) */}
      <div className="sm:hidden grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate('/pos')}
          className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all"
        >
          <Store className="w-4 h-4" />
          <span>⚡ شاشة POS</span>
        </button>
        <button
          onClick={() => navigate('/expenses')}
          className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 active:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
        >
          <Receipt className="w-4 h-4" />
          <span>تسجيل مصروف</span>
        </button>
      </div>

      {/* Main KPI Cards Grid for Cashier */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* 1. نقدية الدرج الفعلية (Drawer Cash) */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-xl border-2 border-amber-400 shadow-sm relative overflow-hidden bg-gradient-to-br from-amber-50/50 to-white">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-black text-amber-900 truncate">نقدية الدرج (كاش)</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-amber-800 tracking-tight font-mono">
            {isLoading ? '...' : formatCurrency(kpis?.today_cash_flow ?? 0)}
          </div>
          <div className="text-[10px] sm:text-[11px] font-medium text-amber-700 mt-1 truncate">
            الكاش الفعلي بالدرج
          </div>
        </div>

        {/* 2. إجمالي مبيعات الوردية (Net Sales) */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">مبيعات الوردية</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
            {isLoading ? '...' : formatCurrency(kpis?.today_sales ?? 0)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
            مبيعات الكاشير الصافية
          </div>
        </div>

        {/* 3. مدفوعات إلكترونية / شبكة */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">إلكتروني (فيزا/محفظة)</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-purple-600 tracking-tight font-mono">
            {isLoading ? '...' : formatCurrency(cashFlow?.inflow.electronic_sales ?? 0)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
            خارج الدرج النقدي
          </div>
        </div>

        {/* 4. مصروفات ونثريات الدرج */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">مصروفات الدرج</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-rose-600 tracking-tight font-mono">
            {isLoading ? '...' : formatCurrency(kpis?.today_expenses ?? 0)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
            صُرفت من الدرج
          </div>
        </div>
      </div>

      {/* Drawer Reconciliation & Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* تفصيل جرد ومطابقة نقدية الدرج */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-600" />
              <h3 className="font-black text-slate-900 text-base">
                جرد ومطابقة نقدية الدرج (تقفيل الوردية)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">تسوية دقيقة لمحتويات الدرج</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* الداخل للدرج (+) */}
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black text-emerald-800 border-b border-emerald-200/60 pb-2">
                <span className="flex items-center gap-1">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                  نقدية دخلت الدرج (+)
                </span>
                <span>{formatCurrency(cashFlow?.inflow.total ?? 0)}</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>مبيعات نقدية كاش:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(cashFlow?.inflow.cash_sales ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>سندات قبض نقدية بالدرج:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(cashFlow?.inflow.receipt_vouchers ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* الخارج من الدرج (-) */}
            <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black text-rose-800 border-b border-rose-200/60 pb-2">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4 text-rose-600" />
                  نقدية خرجت من الدرج (-)
                </span>
                <span>{formatCurrency(cashFlow?.outflow.total ?? 0)}</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>مرتجعات بيع كاش مردودة للعملاء:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(cashFlow?.outflow.sale_returns ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>مصروفات ونثريات مسحوبة من الدرج:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(cashFlow?.outflow.expenses ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* خلاصة جرد الدرج */}
          <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-xs font-bold text-slate-200">
                  صافي النقدية الواجب توفرها في الدرج عند التسليم:
                </div>
                <div className="text-[11px] text-slate-400">
                  (مبيعات الكاش + المقبوضات - المرتجعات - نثريات الدرج)
                </div>
              </div>
            </div>
            <span className="text-2xl font-black text-amber-400 tracking-tight">
              {formatCurrency(cashFlow?.net_cash_flow ?? 0)}
            </span>
          </div>
        </div>

        {/* اختصارات الكاشير */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h3 className="font-black text-slate-900 text-base mb-3 flex items-center gap-2">
            <Store className="w-5 h-5 text-primary-600" />
            روابط سريعة للكاشير
          </h3>

          <button
            onClick={() => navigate('/sales/new')}
            className="w-full text-right p-3 rounded-lg border border-primary-200 bg-primary-50/50 hover:bg-primary-100/50 flex items-center justify-between transition-all"
          >
            <div>
              <div className="text-xs font-bold text-primary-900">نقطة البيع السريعة (POS)</div>
              <div className="text-[11px] text-primary-700">فتح شاشة الكاشير وإصدار فواتير</div>
            </div>
            <span className="text-primary-700 font-bold">&larr;</span>
          </button>

          <button
            onClick={() => navigate('/sales')}
            className="w-full text-right p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 flex items-center justify-between transition-all"
          >
            <div>
              <div className="text-xs font-bold text-slate-900">فواتير الوردية</div>
              <div className="text-[11px] text-slate-500">مراجعة وطباعة فواتير الوردية</div>
            </div>
            <span className="text-slate-600 font-bold">&larr;</span>
          </button>

          <button
            onClick={() => navigate('/expenses')}
            className="w-full text-right p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 flex items-center justify-between transition-all"
          >
            <div>
              <div className="text-xs font-bold text-slate-900">مصروفات ونثريات الدرج</div>
              <div className="text-[11px] text-slate-500">تسجيل أي مبالغ سُحبت من الدرج</div>
            </div>
            <span className="text-slate-600 font-bold">&larr;</span>
          </button>

          <button
            onClick={() => navigate('/customers')}
            className="w-full text-right p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 flex items-center justify-between transition-all"
          >
            <div>
              <div className="text-xs font-bold text-slate-900">حسابات العملاء</div>
              <div className="text-[11px] text-slate-500">البحث عن عميل أو تسجيل عميل جديد</div>
            </div>
            <span className="text-slate-600 font-bold">&larr;</span>
          </button>
        </div>
      </div>

      {/* جدول آخر حركات الوردية */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-700" />
            <h3 className="font-black text-slate-900 text-base">آخر حركات الوردية المسجلة</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">أحدث 5 حركات لك</span>
        </div>

        {recentActivities.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            لا توجد حركات مسجلة بالوردية حتى الآن
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
