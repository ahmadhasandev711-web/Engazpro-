import React, { useMemo } from 'react';
import { DateRangeFilter } from '../common/DateRangeFilter';
import { formatCurrency } from '@pos-mandob/shared';
import { ShoppingBag, Search, CheckCircle2, AlertCircle, X, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Tabs, TabItem } from '../ui/Tabs';
import { cn } from '../../utils/cn';
import type { WcOrdersViewModel } from './types';

export const WcOrdersToolbar: React.FC<{ vm: WcOrdersViewModel }> = ({ vm }) => {
  const {
    canPullOrders,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    feedback,
    setFeedback,
    orders,
    pullMutation,
    user,
  } = vm;

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: orders.length,
      PENDING_CONFIRMATION: 0,
      CONFIRMED: 0,
      DISPATCHED: 0,
      SHIPPED_VIA_COURIER: 0,
      DELIVERED: 0,
      RETURNED: 0,
    };
    orders.forEach((o: any) => {
      if (counts[o.status] !== undefined) {
        counts[o.status]++;
      }
    });
    return counts;
  }, [orders]);

  const tabs: TabItem[] = [
    { id: 'ALL', label: 'كافة الطلبات', count: tabCounts.ALL },
    { id: 'PENDING_CONFIRMATION', label: 'بانتظار التأكيد', count: tabCounts.PENDING_CONFIRMATION },
    { id: 'CONFIRMED', label: 'مؤكدة وقيد التجهيز', count: tabCounts.CONFIRMED },
    { id: 'DISPATCHED', label: 'مع المناديب', count: tabCounts.DISPATCHED },
    { id: 'SHIPPED_VIA_COURIER', label: 'مع شركات الشحن', count: tabCounts.SHIPPED_VIA_COURIER },
    { id: 'DELIVERED', label: 'تم تسليمها', count: tabCounts.DELIVERED },
    { id: 'RETURNED', label: 'مرتجع', count: tabCounts.RETURNED },
  ];

  const storeSubtitle = user?.business_name
    ? `متجر ${user.business_name} — متابعة وتأكيد طلبات المتجر والتوصيل الميداني`
    : 'متابعة وتأكيد طلبات المتجر، التوزيع على المناديب وسيارات التوصيل، والتسليم على باب البيت';

  return (
    <>
      {/* Desktop Header (hidden on mobile) */}
      <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-panel p-6 rounded-3xl border border-line shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-soft border border-brand/20 flex items-center justify-center text-brand-ink shadow-2xs shrink-0">
            <ShoppingBag className="w-7 h-7 text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-black text-ink">طلبيات ووكومرس والتوصيل الميداني</h1>
            <p className="text-xs text-muted mt-1 leading-relaxed">{storeSubtitle}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          {canPullOrders && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => pullMutation.mutate()}
              disabled={pullMutation.isPending}
              isLoading={pullMutation.isPending}
              leftIcon={<RefreshCw className="w-4 h-4" />}
              className="shrink-0 font-bold"
            >
              <span>{pullMutation.isPending ? 'جاري سحب الطلبات...' : 'سحب الطلبات الآن'}</span>
            </Button>
          )}

          {/* Search */}
          <div className="w-full sm:w-72">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالطلب أو العميل أو الهاتف..."
              leftIcon={<Search className="w-4 h-4 text-muted" />}
            />
          </div>
        </div>
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className="md:hidden bg-panel border border-line rounded-2xl p-4 text-ink shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-2xs font-bold text-muted">
            <ShoppingBag className="w-3.5 h-3.5 text-brand" />
            <span>طلبيات المتجر ({orders.length})</span>
          </div>
          <h3 className="text-lg font-black mt-0.5 text-ink tabular-nums">
            {formatCurrency(orders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0))}
          </h3>
        </div>
        {canPullOrders && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => pullMutation.mutate()}
            disabled={pullMutation.isPending}
            isLoading={pullMutation.isPending}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            className="font-bold text-xs"
          >
            سحب الطلبات
          </Button>
        )}
      </div>

      {/* Mobile Search Bar (md:hidden) */}
      <div className="md:hidden w-full">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالطلب أو العميل أو الهاتف..."
          leftIcon={<Search className="w-4 h-4 text-muted" />}
        />
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={cn(
            'p-4 rounded-2xl border flex items-start justify-between gap-3 animate-in fade-in duration-150',
            feedback.type === 'success'
              ? 'bg-ok-soft border-ok/20 text-ok'
              : 'bg-bad-soft border-bad/20 text-bad'
          )}
        >
          <div className="flex items-start gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-ok mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-bad mt-0.5" />
            )}
            <span className="text-xs font-bold whitespace-pre-line leading-relaxed">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-surface-2 rounded-lg text-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Filter Tabs (Horizontal scroll on mobile with zero page overflow) */}
      <div className="w-full min-w-0 max-w-full overflow-hidden">
        <Tabs
          tabs={tabs}
          activeTab={statusFilter}
          onChange={(id) => setStatusFilter(id)}
        />
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-panel p-3 rounded-2xl border border-line shadow-xs w-full min-w-0 max-w-full overflow-hidden">
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
