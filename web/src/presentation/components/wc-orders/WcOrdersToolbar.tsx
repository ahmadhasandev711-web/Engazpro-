import React from 'react';
import { DateRangeFilter } from '../common/DateRangeFilter';
import { MobileFilterChips } from '../mobile/MobileFilterChips';
import { formatCurrency } from '@pos-mandob/shared';
import { ShoppingBag, Search, CheckCircle2, AlertCircle, X, RefreshCw } from 'lucide-react';
import type { WcOrdersViewModel } from './types';

export const WcOrdersToolbar: React.FC<{ vm: WcOrdersViewModel }> = ({ vm }) => {
  const { canPullOrders, search, setSearch, statusFilter, setStatusFilter, fromDate, setFromDate, toDate, setToDate, feedback, setFeedback, orders, pullMutation } = vm;

  return (
    <>
      {/* Desktop Header (hidden on mobile) */}
      <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">طلبيات ووكومرس والتوصيل الميداني</h1>
            <p className="text-xs text-slate-500 mt-1">
              متابعة وتأكيد طلبات المتجر، التوزيع على المناديب وسيارات التوصيل، والتسليم على باب البيت
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          {canPullOrders && (
            <button
              onClick={() => pullMutation.mutate()}
              disabled={pullMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/20 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${pullMutation.isPending ? 'animate-spin' : ''}`} />
              <span>{pullMutation.isPending ? 'جاري سحب الطلبات...' : '🔄 سحب وتحديث الطلبات الآن'}</span>
            </button>
          )}

          {/* Search */}
          <div className="w-full sm:w-72 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الطلب أو العميل أو الهاتف..."
              className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className="md:hidden bg-gradient-to-l from-amber-600 to-orange-600 rounded-2xl p-3.5 text-white shadow-md flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1 text-[11px] font-bold opacity-90">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>طلبيات المتجر ({orders.length})</span>
          </div>
          <h3 className="text-xl font-black mt-0.5 tracking-tight">
            {formatCurrency(orders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0))}
          </h3>
        </div>
        {canPullOrders && (
          <button
            type="button"
            onClick={() => pullMutation.mutate()}
            disabled={pullMutation.isPending}
            className="px-3 py-2 bg-white text-amber-700 hover:bg-amber-50 rounded-xl font-black text-xs shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${pullMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{pullMutation.isPending ? 'جاري السحب...' : 'سحب الطلبات'}</span>
          </button>
        )}
      </div>

      {/* Mobile Search Bar (md:hidden) */}
      <div className="md:hidden w-full relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالطلب أو العميل أو الهاتف..."
          className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs text-right"
        />
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 animate-in fade-in duration-150 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-start gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
            )}
            <span className="text-xs font-bold whitespace-pre-line leading-relaxed">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Filter Tabs (Horizontal scroll on mobile) */}
      <MobileFilterChips
        options={[
          { id: 'ALL', label: 'كافة الطلبات' },
          { id: 'PENDING_CONFIRMATION', label: 'بانتظار التأكيد' },
          { id: 'CONFIRMED', label: 'مؤكدة وقيد التجهيز' },
          { id: 'DISPATCHED', label: 'مع المناديب' },
          { id: 'SHIPPED_VIA_COURIER', label: 'مع شركات الشحن' },
          { id: 'DELIVERED', label: 'تم تسليمها' },
          { id: 'RETURNED', label: 'مرتجع' },
        ]}
        selectedId={statusFilter}
        onSelect={(id) => setStatusFilter(id)}
      />

      {/* Date Range Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm w-full min-w-0 max-w-full overflow-hidden">
        <DateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          defaultPreset="today"
          onChange={(from, to) => {
            setFromDate(from);
            setToDate(to);
          }}
        />
      </div>
    </>
  );
};
