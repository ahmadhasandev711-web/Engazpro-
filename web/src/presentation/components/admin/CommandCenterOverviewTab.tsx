import React from 'react';
import {
  AlertTriangle,
  ArrowUpLeft,
  Clock,
  CreditCard,
  DollarSign,
  KeyRound,
  Package,
  Phone,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { AdminCommandCenterOverview, formatCurrency } from '@pos-mandob/shared';
import { Badge, Button, Card, EmptyState, StatCard } from '../ui';
import { AdminKPICards } from './AdminKPICards';
import type { AdminSectionId } from './AdminSidebar';
import { STOCK_MODE_META } from './easyfy/easyfyUiMeta';

interface CommandCenterOverviewTabProps {
  overview?: AdminCommandCenterOverview;
  isLoading: boolean;
  onNavigateSection: (section: AdminSectionId) => void;
  onOpenStoreManage: (userId: number) => void;
}

export const CommandCenterOverviewTab: React.FC<CommandCenterOverviewTabProps> = ({
  overview,
  isLoading,
  onNavigateSection,
  onOpenStoreManage,
}) => {
  const easyfy = overview?.easyfy_store;
  const platform = overview?.platform;
  const alerts = overview?.alerts;

  const subRecorded = platform?.financials.recorded_revenue_egp ?? 0;
  const subEstimated = platform?.financials.estimated_revenue_egp ?? 0;
  const subRevenue = subRecorded > 0 ? subRecorded : subEstimated;
  const storeRevenue = easyfy?.gross_revenue ?? 0;
  const storeProfit = easyfy?.gross_profit ?? 0;
  const profitMargin = storeRevenue > 0 ? Math.round((storeProfit / storeRevenue) * 100) : 0;

  const series = easyfy?.daily_30d_series ?? [];
  const maxDayRevenue = Math.max(1, ...series.map((d) => Number(d.revenue || 0)));

  return (
    <div className="space-y-6">
      {/* Split Revenue & Store Command KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="دخل اشتراكات المنصة"
          value={formatCurrency(subRevenue)}
          tone="brand"
          highlight
          icon={<CreditCard className="w-4 h-4" />}
          hint={`إجمالي المتاجر: ${platform?.users.merchants ?? 0} (${platform?.subscriptions.active ?? 0} نشط)`}
        />

        <StatCard
          label="مبيعات متجر Easyfy"
          value={formatCurrency(storeRevenue)}
          tone="info"
          icon={<ShoppingBag className="w-4 h-4" />}
          hint={`عدد الطلبات: ${easyfy?.orders_count ?? 0} • متوسط الطلب: ${formatCurrency(easyfy?.avg_order_value ?? 0)}`}
        />

        <StatCard
          label="صافي ربح متجر Easyfy"
          value={formatCurrency(storeProfit)}
          tone="ok"
          highlight
          icon={<TrendingUp className="w-4 h-4" />}
          hint={`هامش الربح: ${profitMargin}% • تكلفة البضاعة: ${formatCurrency(easyfy?.total_cost ?? 0)}`}
        />

        <StatCard
          label="إجراءات عاجلة بالمتجر"
          value={(easyfy?.pending_payment_proofs_count ?? 0) + (easyfy?.pending_orders_count ?? 0)}
          tone={(easyfy?.pending_payment_proofs_count ?? 0) > 0 ? 'bad' : 'warn'}
          icon={<DollarSign className="w-4 h-4" />}
          hint={
            <div className="flex items-center justify-between gap-2 pt-1.5">
              <span className="text-bad font-bold">تحويلات للمراجعة: {easyfy?.pending_payment_proofs_count ?? 0}</span>
              <button
                type="button"
                onClick={() => onNavigateSection('easyfy-orders')}
                className="text-brand-ink font-bold inline-flex items-center gap-1 hover:underline"
              >
                <span>فتح الطلبات</span>
                <ArrowUpLeft className="w-3 h-3" />
              </button>
            </div>
          }
        />
      </div>

      {/* Platform Infrastructure KPI Row */}
      <AdminKPICards stats={platform} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* 30-day Store Revenue & Profit Bar Chart */}
        <Card className="p-5 xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="font-black text-base text-ink">أداء مبيعات وأرباح متجر Easyfy (آخر 30 يوم)</h3>
              <p className="text-xs text-muted mt-0.5">
                إجمالي الشحن المحصل: {formatCurrency(easyfy?.shipping_collected ?? 0)} • تنبيهات المخزون المنخفض:{' '}
                {easyfy?.low_stock_variants_count ?? 0}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => onNavigateSection('easyfy-orders')}>
              إدارة الطلبات
            </Button>
          </div>

          {isLoading ? (
            <div className="h-44 rounded-xl bg-surface-2 animate-pulse" />
          ) : series.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="w-8 h-8 text-muted" />}
              title="لا توجد طلبات مكتملة بعد خلال آخر 30 يوم"
              description="ستظهر أعمدة المبيعات وصافي الربح تلقائياً فور وصول أول طلب من التجار."
            />
          ) : (
            <div className="space-y-3">
              <div className="h-48 flex items-end gap-1.5 px-2 pt-6 pb-2 bg-canvas border border-line rounded-xl overflow-x-auto">
                {series.map((pt) => {
                  const revH = Math.max(8, Math.round((Number(pt.revenue) / maxDayRevenue) * 100));
                  const profH = Math.max(
                    4,
                    Math.round((Math.max(0, Number(pt.profit)) / maxDayRevenue) * 100)
                  );
                  return (
                    <div
                      key={pt.day}
                      title={`${pt.day} | طلبات: ${pt.orders_count} | مبيعات: ${formatCurrency(pt.revenue)} | ربح: ${formatCurrency(pt.profit)}`}
                      className="flex-1 min-w-[20px] h-full flex flex-col justify-end items-center gap-1 group"
                    >
                      <div className="w-full flex items-end justify-center gap-0.5 h-36">
                        <div
                          className="w-2.5 sm:w-3 rounded-t-md bg-brand/80 group-hover:bg-brand transition-colors"
                          style={{ height: `${revH}%` }}
                        />
                        <div
                          className="w-2 sm:w-2.5 rounded-t-md bg-ok/80 group-hover:bg-ok transition-colors"
                          style={{ height: `${profH}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted tabular-nums whitespace-nowrap">
                        {pt.day.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted font-bold">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-brand inline-block" />
                  <span>المبيعات اليومية</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-ok inline-block" />
                  <span>صافي الربح اليومي</span>
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Retention Radar: Expiring Trials + Support Alerts */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-warn" />
              <h3 className="font-black text-base text-ink">رادار المتابعة التجارية</h3>
            </div>
            <Badge tone={(alerts?.expiring_trials_72h.length ?? 0) > 0 ? 'warn' : 'ok'}>
              {alerts?.expiring_trials_72h.length ?? 0} تجارب قريبة
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onNavigateSection('system')}
              className="p-3 rounded-xl border border-line bg-canvas hover:border-brand text-right transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
                <KeyRound className="w-3.5 h-3.5 text-warn" />
                <span>طلبات كلمة مرور</span>
              </div>
              <p className="text-lg font-black text-ink mt-1 tabular-nums">
                {alerts?.pending_password_resets_count ?? 0}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigateSection('inquiries')}
              className="p-3 rounded-xl border border-line bg-canvas hover:border-brand text-right transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
                <AlertTriangle className="w-3.5 h-3.5 text-info" />
                <span>طلبات متاجر جديدة</span>
              </div>
              <p className="text-lg font-black text-ink mt-1 tabular-nums">
                {alerts?.new_inquiries_count ?? 0}
              </p>
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            <p className="text-xs font-bold text-muted">تجارب تنتهي خلال 72 ساعة:</p>
            {(alerts?.expiring_trials_72h ?? []).length === 0 ? (
              <p className="text-xs text-muted py-3 text-center bg-canvas rounded-xl border border-line">
                لا توجد اشتراكات تجريبية تنتهي خلال 72 ساعة.
              </p>
            ) : (
              alerts!.expiring_trials_72h.map((trial) => (
                <div
                  key={trial.id}
                  className="p-3 rounded-xl border border-line bg-canvas flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink truncate">
                      {trial.user?.business_name || trial.user?.name || `متجر #${trial.user_id}`}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-muted mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {trial.user?.phone || '-'}
                      </span>
                      <span>• ينتهي: {trial.end_date}</span>
                    </div>
                  </div>
                  {trial.user?.id && (
                    <Button size="sm" variant="secondary" onClick={() => onOpenStoreManage(trial.user!.id)}>
                      إدارة
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Top Requested Easyfy Products */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-brand" />
            <h3 className="font-black text-base text-ink">أكثر منتجات متجر Easyfy طلباً</h3>
          </div>
          <Button size="sm" variant="secondary" onClick={() => onNavigateSection('easyfy-inventory')}>
            تقرير المخزون والطلب الكامل
          </Button>
        </div>

        {(easyfy?.demand_report.top_overall ?? []).length === 0 ? (
          <p className="text-xs text-muted">لم تسجل طلبات منتجات حتى الآن.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {easyfy!.demand_report.top_overall.slice(0, 6).map((row, idx) => {
              const modeMeta = STOCK_MODE_META[row.stock_mode] || { label: String(row.stock_mode), tone: 'neutral' as const };
              return (
                <div
                  key={`${row.variant_id ?? 'v'}-${idx}`}
                  className="p-3.5 rounded-xl border border-line bg-canvas flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-bold text-ink truncate">{row.product_name}</p>
                    <p className="text-xs text-muted truncate">{row.variant_label}</p>
                    <Badge tone={modeMeta.tone}>{modeMeta.label}</Badge>
                  </div>
                  <div className="text-left shrink-0 space-y-0.5">
                    <p className="text-sm font-black text-brand tabular-nums">{Number(row.total_qty)} قطعة</p>
                    <p className="text-[11px] text-ok font-bold tabular-nums">
                      ربح: {formatCurrency(Number(row.total_profit ?? 0))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
