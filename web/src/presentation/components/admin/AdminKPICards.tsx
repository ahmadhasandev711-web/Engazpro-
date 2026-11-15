import React from 'react';
import { Store, Key, CreditCard, Layers } from 'lucide-react';
import { formatCurrency, AdminStatsData } from '@pos-mandob/shared';
import { StatCard } from '../ui';

interface AdminKPICardsProps {
  stats?: AdminStatsData;
}

export const AdminKPICards: React.FC<AdminKPICardsProps> = ({ stats }) => {
  const recordedRevenue = stats?.financials.recorded_revenue_egp ?? 0;
  const estimatedRevenue = stats?.financials.estimated_revenue_egp ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      <StatCard
        label="المتاجر المشتركة"
        value={stats?.users.merchants ?? 0}
        tone="info"
        icon={<Store className="w-4 h-4" />}
        hint={
          <div className="flex items-center justify-between gap-2 text-[11px] font-bold pt-2 border-t border-line">
            <span className="text-ok">{stats?.subscriptions.active ?? 0} نشط</span>
            <span className="text-bad">{stats?.subscriptions.expired ?? 0} منتهي</span>
            <span className="text-info">{stats?.users.staff ?? 0} موظف</span>
          </div>
        }
      />

      <StatCard
        label="بنك أكواد التفعيل"
        value={stats?.licenses.unused ?? 0}
        tone="ok"
        icon={<Key className="w-4 h-4" />}
        hint={
          <div className="flex items-center justify-between gap-2 text-[11px] font-bold pt-2 border-t border-line">
            <span className="text-ink">مستخدم: {stats?.licenses.used ?? 0}</span>
            <span className="text-warn">ملغي: {stats?.licenses.revoked ?? 0}</span>
            <span className="text-muted">إجمالي: {stats?.licenses.total ?? 0}</span>
          </div>
        }
      />

      <StatCard
        label="إيرادات الاشتراكات"
        value={formatCurrency(recordedRevenue > 0 ? recordedRevenue : estimatedRevenue)}
        tone="brand"
        highlight
        icon={<CreditCard className="w-4 h-4" />}
        hint={
          <div className="flex items-center justify-between gap-2 text-[11px] font-bold pt-2 border-t border-brand/20">
            <span className="text-muted">تقديري: {formatCurrency(estimatedRevenue)}</span>
            <span className="text-brand-ink">مسجل: {formatCurrency(recordedRevenue)}</span>
          </div>
        }
      />

      <StatCard
        label="نشاط المنصة الكلي"
        value={stats?.activity.invoices ?? 0}
        tone="warn"
        icon={<Layers className="w-4 h-4" />}
        hint={
          <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-muted pt-2 border-t border-line">
            <span>{stats?.activity.products ?? 0} صنف</span>
            <span>{stats?.activity.parties ?? 0} عميل ومورد</span>
          </div>
        }
      />
    </div>
  );
};
