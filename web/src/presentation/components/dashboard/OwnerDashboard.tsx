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
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { PWAInstallBanner } from '../pwa/PWAInstallBanner';
import { usePermissions } from '../../../hooks/usePermissions';
import { useStockAlertsSummary } from '../../../hooks/useStockOperations';
import { RecentActivityMobileCard } from '../mobile/RecentActivityMobileCard';
import {
  Badge,
  BadgeTone,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  StatCard,
} from '../ui';

export interface DashboardData {
  today: string;
  kpis: {
    today_sales: number;
    today_gross_sales?: number;
    today_cash_sales?: number;
    today_courier_pending_sales?: number;
    today_electronic_sales?: number;
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

const getActivityBadgeTone = (type: string): BadgeTone => {
  if (type === 'SALE') return 'info';
  if (type === 'PURCHASE') return 'brand';
  if (type === 'SALE_RETURN' || type === 'PURCHASE_RETURN') return 'warn';
  if (type === 'RECEIPT') return 'ok';
  if (type === 'PAYMENT' || type === 'EXPENSE') return 'bad';
  return 'neutral';
};

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  data,
  isLoading,
  isFetching,
  refetch,
}) => {
  const navigate = useNavigate();
  const { isManager, canViewProfitReport, canManageStockOperations } = usePermissions();
  const { data: alertsSummary } = useStockAlertsSummary(canManageStockOperations);
  const kpis = data?.kpis;
  const showProfitCard =
    canViewProfitReport && kpis?.today_profit !== null && kpis?.today_profit !== undefined;
  const cashFlow = data?.cash_flow;
  const recentActivities = data?.recent_activities || [];

  return (
    <div className="space-y-6">
      {/* PWA Install Banner */}
      <PWAInstallBanner />

      {/* Header & Quick Action Buttons */}
      <PageHeader
        title="لوحة المتابعة الشاملة"
        description={
          isManager
            ? 'ملخص فوري لمبيعات وحصيلة اليوم النقدية ومصروفات الفرع'
            : 'ملخص فوري لمبيعات وأرباح وحصيلة اليوم النقدية الصافية للمتجر'
        }
        badge={
          <Badge tone="brand" className="tabular-nums">
            {data?.today || new Date().toISOString().split('T')[0]}
          </Badge>
        }
        className="mb-0"
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => refetch()}
              disabled={isFetching}
              title="تحديث البيانات"
              aria-label="تحديث البيانات"
              className="px-3"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-brand' : ''}`} />
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/sales/new')}
              leftIcon={<PlusCircle className="w-4 h-4" />}
              className="hidden sm:inline-flex"
            >
              فاتورة جديدة
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/payments')}
              leftIcon={<CreditCard className="w-4 h-4 text-ok" />}
              className="hidden sm:inline-flex border-ok/30 bg-ok-soft text-ok hover:bg-ok-soft/80"
            >
              سند قبض / صرف
            </Button>
          </>
        }
      />

      {/* Mobile Quick Action Buttons (sm:hidden) */}
      <div className="sm:hidden grid grid-cols-2 gap-2">
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate('/sales/new')}
          leftIcon={<PlusCircle className="w-4 h-4" />}
          className="w-full text-xs font-bold"
        >
          فاتورة جديدة
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => navigate('/payments')}
          leftIcon={<CreditCard className="w-4 h-4 text-ok" />}
          className="w-full text-xs font-bold border-ok/30 bg-ok-soft text-ok hover:bg-ok-soft/80"
        >
          سند قبض / صرف
        </Button>
      </div>

      {/* Low Stock / Expiring Batch Alert Banner */}
      {canManageStockOperations && (alertsSummary?.total_alerts ?? 0) > 0 && (
        <Card className="p-3.5 sm:p-4 bg-warn-soft/50 border-warn/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-warn-soft text-warn flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-ink">
                تنبيهات المخزون تحتاج مراجعة ({alertsSummary?.total_alerts} تنبيه)
              </p>
              <p className="text-xs text-muted tabular-nums">
                {alertsSummary?.low_stock_count ?? 0} صنف تحت حد الأمان
                {(alertsSummary?.expiring_batches_count ?? 0) > 0
                  ? ` • ${alertsSummary?.expiring_batches_count} تشغيلة منتهية أو قريبة الانتهاء`
                  : ''}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => navigate('/stock-operations')}
            className="border-warn/40 bg-panel hover:bg-warn-soft text-ink text-xs font-bold shrink-0"
          >
            عرض النواقص وإعادة الطلب
          </Button>
        </Card>
      )}

      {/* Main KPI Cards Grid */}
      <div
        className={`grid grid-cols-2 ${showProfitCard ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-2.5 sm:gap-4`}
      >
        {/* 1. مبيعات اليوم الصافية */}
        <StatCard
          label={isManager ? 'مبيعات الفرع اليوم' : 'مبيعات اليوم الصافية'}
          value={isLoading ? '...' : formatCurrency(kpis?.today_sales ?? 0)}
          tone="info"
          icon={<ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          hint={
            <div className="flex items-center justify-between gap-1 truncate">
              <span>الشهر:</span>
              <span className="font-bold text-ink tabular-nums">
                {formatCurrency(kpis?.month_sales ?? 0)}
              </span>
            </div>
          }
        >
          {(Number(kpis?.today_courier_pending_sales) > 0 ||
            Number(kpis?.today_electronic_sales) > 0) && (
            <div className="mt-2 pt-2 border-t border-line space-y-0.5 text-[11px]">
              {Number(kpis?.today_cash_sales) > 0 && (
                <div className="flex justify-between text-muted">
                  <span>كاش بالخزينة:</span>
                  <span className="font-bold text-ok tabular-nums">
                    {formatCurrency(kpis?.today_cash_sales ?? 0)}
                  </span>
                </div>
              )}
              {Number(kpis?.today_courier_pending_sales) > 0 && (
                <div className="flex justify-between text-brand">
                  <span>معلق شحن:</span>
                  <span className="font-bold tabular-nums">
                    {formatCurrency(kpis?.today_courier_pending_sales ?? 0)}
                  </span>
                </div>
              )}
              {Number(kpis?.today_electronic_sales) > 0 && (
                <div className="flex justify-between text-info">
                  <span>إلكتروني:</span>
                  <span className="font-bold tabular-nums">
                    {formatCurrency(kpis?.today_electronic_sales ?? 0)}
                  </span>
                </div>
              )}
            </div>
          )}
        </StatCard>

        {/* 2. صافي أرباح اليوم - للمالك ومدير النظام فقط */}
        {showProfitCard && (
          <StatCard
            label="صافي أرباح اليوم"
            value={isLoading ? '...' : formatCurrency(kpis?.today_profit ?? 0)}
            tone="ok"
            icon={<TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            hint="بعد التكلفة والمصروفات"
          />
        )}

        {/* 3. الحصيلة النقدية الصافية لليوم (Cash Flow) */}
        <StatCard
          label="نقدية الخزينة"
          value={isLoading ? '...' : formatCurrency(kpis?.today_cash_flow ?? 0)}
          tone="warn"
          highlight
          icon={<Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          hint="المبلغ الفعلي بالخزينة"
        />

        {/* 4. مصروفات اليوم */}
        <StatCard
          label="مصروفات اليوم"
          value={isLoading ? '...' : formatCurrency(kpis?.today_expenses ?? 0)}
          tone="bad"
          icon={<Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          hint="إجمالي المنصرف"
        />
      </div>

      {/* Cash Flow Breakdown & Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* تفصيل حركة النقدية لليوم */}
        <Card className="lg:col-span-2 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-warn" />
              <h3 className="font-black text-ink text-base">
                {isManager
                  ? 'تفصيل حركة النقدية لليوم (خزينة الفرع)'
                  : 'تفصيل حركة النقدية لليوم (الخزينة العامة)'}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="md"
              onClick={() => navigate('/reports')}
              className="text-xs font-bold text-brand hover:underline px-2"
            >
              عرض تقرير الخزينة المفصل &larr;
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* الداخل (Inflow) */}
            <div className="p-4 rounded-xl bg-ok-soft/50 border border-ok/20 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black text-ok border-b border-ok/20 pb-2">
                <span className="flex items-center gap-1">
                  <ArrowDownLeft className="w-4 h-4 text-ok" />
                  المقبوضات النقدية الداخلة (+)
                </span>
                <span className="tabular-nums">{formatCurrency(cashFlow?.inflow.total ?? 0)}</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted">
                <div className="flex justify-between">
                  <span>مبيعات نقدية:</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.inflow.cash_sales ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>سندات قبض من عملاء:</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.inflow.receipt_vouchers ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>مرتجعات شراء مستردة:</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.inflow.purchase_returns ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* الخارج (Outflow) */}
            <div className="p-4 rounded-xl bg-bad-soft/50 border border-bad/20 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black text-bad border-b border-bad/20 pb-2">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4 text-bad" />
                  المدفوعات النقدية الخارجة (-)
                </span>
                <span className="tabular-nums">{formatCurrency(cashFlow?.outflow.total ?? 0)}</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted">
                <div className="flex justify-between">
                  <span>مشتريات نقدية:</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.outflow.cash_purchases ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>سندات صرف لموردين:</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.outflow.payment_vouchers ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>مرتجعات بيع مردودة للعملاء:</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.outflow.sale_returns ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>مصروفات اليوم:</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.outflow.expenses ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* الخلاصة الصافية */}
          <div className="p-3.5 bg-warn-soft border border-warn/30 rounded-xl flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-ink">
              صافي النقدية الفعلية لليوم (الداخل - الخارج):
            </span>
            <span className="text-lg font-black text-warn tabular-nums">
              {formatCurrency(cashFlow?.net_cash_flow ?? 0)}
            </span>
          </div>
        </Card>

        {/* روابط سريعة */}
        <Card className="p-5 space-y-3">
          <h3 className="font-black text-ink text-base mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted" />
            روابط وتقارير سريعة
          </h3>

          <button
            type="button"
            onClick={() => navigate('/sales')}
            className="w-full min-h-[44px] text-right p-3 rounded-xl border border-line hover:border-brand/30 hover:bg-brand-soft/40 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-ink">سجل فواتير البيع</div>
              <div className="text-[11px] text-muted">متابعة الفواتير والتحصيلات</div>
            </div>
            <span className="text-brand font-bold">&larr;</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/customers')}
            className="w-full min-h-[44px] text-right p-3 rounded-xl border border-line hover:border-brand/30 hover:bg-brand-soft/40 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-ink">العملاء (كشف الحساب)</div>
              <div className="text-[11px] text-muted">متابعة المديونيات والأرصدة</div>
            </div>
            <span className="text-brand font-bold">&larr;</span>
          </button>

          {canViewProfitReport ? (
            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="w-full min-h-[44px] text-right p-3 rounded-xl border border-line hover:border-brand/30 hover:bg-brand-soft/40 flex items-center justify-between transition-colors cursor-pointer"
            >
              <div>
                <div className="text-xs font-bold text-ink">تقارير الأرباح والمخزون</div>
                <div className="text-[11px] text-muted">حسابات الأرباح والنواقص</div>
              </div>
              <span className="text-brand font-bold">&larr;</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="w-full min-h-[44px] text-right p-3 rounded-xl border border-line hover:border-brand/30 hover:bg-brand-soft/40 flex items-center justify-between transition-colors cursor-pointer"
            >
              <div>
                <div className="text-xs font-bold text-ink">تقارير حركة ومبيعات الفرع</div>
                <div className="text-[11px] text-muted">متابعة المبيعات وحركات الخزينة والمخزون</div>
              </div>
              <span className="text-brand font-bold">&larr;</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/expenses')}
            className="w-full min-h-[44px] text-right p-3 rounded-xl border border-line hover:border-brand/30 hover:bg-brand-soft/40 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-ink">سجل المصروفات</div>
              <div className="text-[11px] text-muted">تسجيل وتصنيف المصاريف اليومية</div>
            </div>
            <span className="text-brand font-bold">&larr;</span>
          </button>
        </Card>
      </div>

      {/* جدول آخر 5 حركات مسجلة */}
      <Card className="p-0 sm:p-0 overflow-hidden">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted" />
            <h3 className="font-black text-ink text-base">آخر الحركات المسجلة في النظام</h3>
          </div>
          <span className="text-xs text-muted font-medium">أحدث 5 عمليات</span>
        </div>

        {recentActivities.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-6 h-6" />}
            title="لا توجد حركات مسجلة بعد في النظام"
            className="border-0 rounded-none py-10"
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <DataTable className="hidden md:block border-0 rounded-none shadow-none">
              <thead className="bg-surface-2 text-muted border-b border-line font-bold text-xs">
                <tr>
                  <th className="p-3">نوع الحركة</th>
                  <th className="p-3">المرجع / البيان</th>
                  <th className="p-3">الطرف / الحساب</th>
                  <th className="p-3">المسؤول / المنشئ</th>
                  <th className="p-3">التاريخ والوقت</th>
                  <th className="p-3 text-left">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-xs">
                {recentActivities.map((act, idx) => (
                  <tr key={idx} className="hover:bg-surface-2/60 transition-colors">
                    <td className="p-3">
                      <Badge tone={getActivityBadgeTone(act.type)}>{act.type_label}</Badge>
                    </td>
                    <td className="p-3 font-bold text-ink">{act.reference}</td>
                    <td className="p-3 text-muted">{act.party_name}</td>
                    <td className="p-3">
                      {act.created_by_name ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-ink">{act.created_by_name}</span>
                          <span className="text-[11px] text-muted">
                            {act.created_by_role === 'MANDOB'
                              ? 'مندوب مبيعات'
                              : act.created_by_role === 'CASHIER'
                                ? 'كاشير'
                                : act.created_by_role === 'MANAGER'
                                  ? 'مدير'
                                  : act.created_by_role === 'SUPERVISOR'
                                    ? 'مشرف'
                                    : 'المالك'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">المالك</span>
                      )}
                    </td>
                    <td className="p-3 text-muted tabular-nums text-[11px]">
                      {act.created_at || act.date}
                    </td>
                    <td className="p-3 text-left font-black text-ink tabular-nums">
                      {formatCurrency(act.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>

            {/* Mobile Touch Cards View */}
            <div className="md:hidden p-3 space-y-2.5 bg-surface-2/50">
              {recentActivities.map((act) => (
                <RecentActivityMobileCard key={act.id} activity={act} />
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
