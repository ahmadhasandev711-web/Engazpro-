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

interface MandobDashboardProps {
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
      {/* Header & Quick Action Buttons */}
      <PageHeader
        title="دفتر المندوب الميداني"
        description="متابعة فورية للمبيعات الميدانية، تحصيلات العملاء، ومطابقة العهدة النقدية باليد"
        badge={
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge tone="neutral">{userName || 'مندوب التوزيع'}</Badge>
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
              leftIcon={<CreditCard className="w-4 h-4 text-muted" />}
              className="hidden sm:inline-flex"
            >
              تحصيل سند قبض
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
          leftIcon={<CreditCard className="w-4 h-4 text-muted" />}
          className="w-full text-xs font-bold"
        >
          تحصيل سند قبض
        </Button>
      </div>

      {/* Main KPI Cards Grid for Mandob */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* 1. العهدة النقدية الفعلية باليد (Most Important Metric for Mandob) */}
        <StatCard
          label="العهدة باليد (كاش)"
          value={isLoading ? '...' : formatCurrency(kpis?.today_cash_flow ?? 0)}
          tone="warn"
          highlight
          icon={<Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          hint="المطلوب تسليمه"
        />

        {/* 2. إجمالي مبيعاتي اليوم (Net Sales) */}
        <StatCard
          label="مبيعاتي اليوم"
          value={isLoading ? '...' : formatCurrency(kpis?.today_sales ?? 0)}
          tone="info"
          icon={<ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          hint="صافي مبيعات اليوم"
        />

        {/* 3. مبيعات آجلة مسجلة اليوم (Credit Sales) */}
        <StatCard
          label="مبيعات آجلة"
          value={isLoading ? '...' : formatCurrency(kpis?.today_credit_sales ?? 0)}
          tone="brand"
          icon={<Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          hint="آجل على العملاء"
        />

        {/* 4. مصاريف خط السير المسجلة اليوم */}
        <StatCard
          label="مصاريف السير"
          value={isLoading ? '...' : formatCurrency(kpis?.today_expenses ?? 0)}
          tone="bad"
          icon={<Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          hint="بنزين ونثريات مخصومة"
        />
      </div>

      {/* Custody Breakdown & Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* تفصيل وتصفية العهدة النقدية اليومية */}
        <Card className="lg:col-span-2 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-warn" />
              <h3 className="font-black text-ink text-base">
                تفصيل وتصفية العهدة النقدية (تقفيل اليومية)
              </h3>
            </div>
            <span className="text-xs text-muted font-medium">حسابات دقيقة بدون تداخل</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* المقبوضات النقدية (+) */}
            <div className="p-4 rounded-xl bg-panel border border-line space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black text-ink border-b border-line pb-2">
                <span className="flex items-center gap-1.5">
                  <ArrowDownLeft className="w-4 h-4 text-ok" />
                  مقبوضات كاش دخلت جيب المندوب (+)
                </span>
                <span className="tabular-nums text-ok">{formatCurrency(cashFlow?.inflow.total ?? 0)}</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted">
                <div className="flex justify-between">
                  <span>مبيعات نقدية محصلة فوراً:</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.inflow.cash_sales ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>تحصيلات سندات قبض من عملاء:</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.inflow.receipt_vouchers ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* المنصرفات النقدية (-) */}
            <div className="p-4 rounded-xl bg-panel border border-line space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black text-ink border-b border-line pb-2">
                <span className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4 text-bad" />
                  مبالغ خرجت من عهدة المندوب (-)
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
                  <span>مرتجعات بيع كاش مردودة للعميل:</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.outflow.sale_returns ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>مصاريف خط السير المسجلة:</span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrency(cashFlow?.outflow.expenses ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* الخلاصة الصافية للعهدة */}
          <div className="p-4 bg-surface-2 border border-line rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-brand shrink-0" />
              <div>
                <div className="text-xs font-bold text-ink">
                  صافي النقدية باليد المطلوب توريدها للخزينة:
                </div>
                <div className="text-[11px] text-muted">
                  (المقبوضات الكاش - سندات الصرف - المرتجعات الكاش - مصاريف خط السير)
                </div>
              </div>
            </div>
            <span className="text-2xl font-black text-ink tracking-tight tabular-nums">
              {formatCurrency(cashFlow?.net_cash_flow ?? 0)}
            </span>
          </div>
        </Card>

        {/* اختصارات المندوب الميداني */}
        <Card className="p-5 space-y-3">
          <h3 className="font-black text-ink text-base mb-3 flex items-center gap-2">
            <Truck className="w-5 h-5 text-warn" />
            الوصول السريع
          </h3>

          <button
            type="button"
            onClick={() => navigate('/sales')}
            className="w-full min-h-[44px] text-right p-3 rounded-xl border border-line hover:border-warn/40 hover:bg-warn-soft/50 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-ink">سجل فواتيري</div>
              <div className="text-[11px] text-muted">فواتير البيع التي سجلتها اليوم</div>
            </div>
            <span className="text-warn font-bold">&larr;</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/customers')}
            className="w-full min-h-[44px] text-right p-3 rounded-xl border border-line hover:border-warn/40 hover:bg-warn-soft/50 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-ink">قائمة العملاء وكشف الحساب</div>
              <div className="text-[11px] text-muted">مديونيات العملاء وعناوينهم</div>
            </div>
            <span className="text-warn font-bold">&larr;</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/expenses')}
            className="w-full min-h-[44px] text-right p-3 rounded-xl border border-line hover:border-warn/40 hover:bg-warn-soft/50 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-ink">مصاريف خط السير</div>
              <div className="text-[11px] text-muted">تسجيل مصاريف البنزين والنثريات</div>
            </div>
            <span className="text-warn font-bold">&larr;</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/payments')}
            className="w-full min-h-[44px] text-right p-3 rounded-xl border border-line hover:border-warn/40 hover:bg-warn-soft/50 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-ink">سندات القبض والصرف</div>
              <div className="text-[11px] text-muted">تحصيلات العملاء وسداد الموردين والشحن</div>
            </div>
            <span className="text-warn font-bold">&larr;</span>
          </button>
        </Card>
      </div>

      {/* جدول آخر حركات المندوب */}
      <Card className="p-0 sm:p-0 overflow-hidden">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted" />
            <h3 className="font-black text-ink text-base">آخر العمليات التي قمت بتسجيلها</h3>
          </div>
          <span className="text-xs text-muted font-medium">أحدث 5 حركات لك</span>
        </div>

        {recentActivities.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-6 h-6" />}
            title="لا توجد حركات مسجلة لك اليوم حتى الآن"
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
