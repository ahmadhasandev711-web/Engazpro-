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

interface CashierDashboardProps {
  data: DashboardData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
  userName?: string;
}

const getActivityBadgeTone = (type: string): BadgeTone => {
  if (type === 'SALE') return 'info';
  if (type === 'SALE_RETURN') return 'warn';
  if (type === 'RECEIPT') return 'ok';
  if (type === 'EXPENSE') return 'bad';
  return 'neutral';
};

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
      {/* Header & Quick Action Buttons */}
      <PageHeader
        title="وردية الكاشير (POS)"
        description="متابعة فورية لمبيعات الوردية، نقدية الدرج، ومصروفات النثريات اليومية"
        badge={
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge tone="neutral">{userName || 'كاشير المتجر'}</Badge>
            <Badge tone="neutral" className="tabular-nums">
              {data?.today || new Date().toISOString().split('T')[0]}
            </Badge>
          </div>
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
              onClick={() => navigate('/pos')}
              leftIcon={<Store className="w-4 h-4" />}
              className="hidden sm:inline-flex font-black"
            >
              ⚡ فتح شاشة البيع السريعة (POS)
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/expenses')}
              leftIcon={<Receipt className="w-4 h-4 text-muted" />}
              className="hidden sm:inline-flex"
            >
              تسجيل مصروف درج
            </Button>
          </>
        }
      />

      {/* Mobile Quick Action Buttons (sm:hidden) */}
      <div className="sm:hidden grid grid-cols-2 gap-2">
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate('/pos')}
          leftIcon={<Store className="w-4 h-4" />}
          className="w-full text-xs font-black"
        >
          ⚡ شاشة POS
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => navigate('/expenses')}
          leftIcon={<Receipt className="w-4 h-4 text-muted" />}
          className="w-full text-xs font-bold"
        >
          تسجيل مصروف
        </Button>
      </div>

      {/* Main KPI Cards Grid for Cashier */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* 1. نقدية الدرج الفعلية (Drawer Cash) */}
        <StatCard
          label="نقدية الدرج (كاش)"
          value={isLoading ? '...' : formatCurrency(kpis?.today_cash_flow ?? 0)}
          tone="warn"
          highlight
          icon={<Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          hint="الكاش الفعلي بالدرج"
        />

        {/* 2. إجمالي مبيعات الوردية (Net Sales) */}
        <StatCard
          label="مبيعات الوردية"
          value={isLoading ? '...' : formatCurrency(kpis?.today_sales ?? 0)}
          tone="info"
          icon={<ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          hint="مبيعات الكاشير الصافية"
        />

        {/* 3. مدفوعات إلكترونية / شبكة */}
        <StatCard
          label="إلكتروني (فيزا/محفظة)"
          value={isLoading ? '...' : formatCurrency(cashFlow?.inflow.electronic_sales ?? 0)}
          tone="brand"
          icon={<CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          hint="خارج الدرج النقدي"
        />

        {/* 4. مصروفات ونثريات الدرج */}
        <StatCard
          label="مصروفات الدرج"
          value={isLoading ? '...' : formatCurrency(kpis?.today_expenses ?? 0)}
          tone="bad"
          icon={<Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          hint="صُرفت من الدرج"
        />
      </div>

      {/* Drawer Reconciliation & Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* تفصيل جرد ومطابقة نقدية الدرج */}
        <Card className="lg:col-span-2 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-warn" />
              <h3 className="font-black text-ink text-base">
                جرد ومطابقة نقدية الدرج (تقفيل الوردية)
              </h3>
            </div>
            <span className="text-xs text-muted font-medium">تسوية دقيقة لمحتويات الدرج</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* الداخل للدرج (+) */}
            <div className="p-4 rounded-xl bg-panel border border-line space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black text-ink border-b border-line pb-2">
                <span className="flex items-center gap-1.5">
                  <ArrowDownLeft className="w-4 h-4 text-ok" />
                  نقدية دخلت الدرج (+)
                </span>
                <span className="tabular-nums text-ok">{formatCurrency(cashFlow?.inflow.total ?? 0)}</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted">
                <div className="flex justify-between">
                  <span>مبيعات نقدية كاش:</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.inflow.cash_sales ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>سندات قبض نقدية بالدرج:</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.inflow.receipt_vouchers ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* الخارج من الدرج (-) */}
            <div className="p-4 rounded-xl bg-panel border border-line space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black text-ink border-b border-line pb-2">
                <span className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4 text-bad" />
                  نقدية خرجت من الدرج (-)
                </span>
                <span className="tabular-nums text-bad">{formatCurrency(cashFlow?.outflow.total ?? 0)}</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted">
                <div className="flex justify-between">
                  <span>سندات صرف نقدية (موردين / شحن):</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.outflow.payment_vouchers ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>مرتجعات بيع كاش مردودة للعملاء:</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.outflow.sale_returns ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>مصروفات ونثريات مسحوبة من الدرج:</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.outflow.expenses ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* خلاصة جرد الدرج */}
          <div className="p-4 bg-surface-2 border border-line rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-brand shrink-0" />
              <div>
                <div className="text-xs font-bold text-ink">
                  صافي النقدية الواجب توفرها في الدرج عند التسليم:
                </div>
                <div className="text-[11px] text-muted">
                  (مبيعات الكاش + المقبوضات - سندات الصرف - المرتجعات - نثريات الدرج)
                </div>
              </div>
            </div>
            <span className="text-2xl font-black text-ink tracking-tight tabular-nums">
              {formatCurrency(cashFlow?.net_cash_flow ?? 0)}
            </span>
          </div>
        </Card>

        {/* اختصارات الكاشير */}
        <Card className="p-5 space-y-3">
          <h3 className="font-black text-ink text-base mb-3 flex items-center gap-2">
            <Store className="w-5 h-5 text-brand" />
            روابط سريعة للكاشير
          </h3>

          <button
            type="button"
            onClick={() => navigate('/sales/new')}
            className="w-full min-h-[44px] text-right p-3 rounded-xl border border-brand/30 bg-brand-soft/60 hover:bg-brand-soft flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-brand-ink">نقطة البيع السريعة (POS)</div>
              <div className="text-[11px] text-brand">فتح شاشة الكاشير وإصدار فواتير</div>
            </div>
            <span className="text-brand font-bold">&larr;</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/sales')}
            className="w-full min-h-[44px] text-right p-3 rounded-xl border border-line hover:border-line-2 hover:bg-surface-2 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-ink">فواتير الوردية</div>
              <div className="text-[11px] text-muted">مراجعة وطباعة فواتير الوردية</div>
            </div>
            <span className="text-muted font-bold">&larr;</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/expenses')}
            className="w-full min-h-[44px] text-right p-3 rounded-xl border border-line hover:border-line-2 hover:bg-surface-2 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-ink">مصروفات ونثريات الدرج</div>
              <div className="text-[11px] text-muted">تسجيل أي مبالغ سُحبت من الدرج</div>
            </div>
            <span className="text-muted font-bold">&larr;</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/customers')}
            className="w-full min-h-[44px] text-right p-3 rounded-xl border border-line hover:border-line-2 hover:bg-surface-2 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-ink">حسابات العملاء</div>
              <div className="text-[11px] text-muted">البحث عن عميل أو تسجيل عميل جديد</div>
            </div>
            <span className="text-muted font-bold">&larr;</span>
          </button>
        </Card>
      </div>

      {/* جدول آخر حركات الوردية */}
      <Card className="p-0 sm:p-0 overflow-hidden">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted" />
            <h3 className="font-black text-ink text-base">آخر حركات الوردية المسجلة</h3>
          </div>
          <span className="text-xs text-muted font-medium">أحدث 5 حركات لك</span>
        </div>

        {recentActivities.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-6 h-6" />}
            title="لا توجد حركات مسجلة بالوردية حتى الآن"
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
                  <th className="p-3">العميل / الحساب</th>
                  <th className="p-3">الوقت</th>
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
