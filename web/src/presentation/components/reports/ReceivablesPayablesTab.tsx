import React from 'react';
import { Users, Truck, Package, Scale } from 'lucide-react';
import {
  formatCurrency,
  ReceivablesPayablesBucketParty,
  ReceivablesPayablesReportData,
} from '@pos-mandob/shared';
import { Badge, Card, DataTable, StatCard } from '../ui';

interface ReceivablesPayablesTabProps {
  data?: ReceivablesPayablesReportData;
  isLoading: boolean;
}

function agingBadge(bucket: ReceivablesPayablesBucketParty['aging_bucket']) {
  switch (bucket) {
    case 'DAYS_60_PLUS':
      return <Badge tone="bad" className="text-2xs font-black">أكثر من 60 يوم</Badge>;
    case 'DAYS_31_60':
      return <Badge tone="warn" className="text-2xs font-black">31–60 يوم</Badge>;
    default:
      return <Badge tone="ok" className="text-2xs font-black">0–30 يوم (جاري)</Badge>;
  }
}

const PartyAgingTable: React.FC<{
  title: string;
  rows: ReceivablesPayablesBucketParty[];
  emptyText: string;
}> = ({ title, rows, emptyText }) => (
  <Card className="p-0 overflow-hidden">
    <div className="px-5 py-4 border-b border-line bg-surface-2/40">
      <h3 className="text-sm font-black text-ink">{title}</h3>
    </div>
    {rows.length === 0 ? (
      <div className="p-8 text-center text-xs text-muted">{emptyText}</div>
    ) : (
      <DataTable>
        <thead>
          <tr className="border-b border-line bg-surface-2/40 text-xs font-black text-muted">
            <th className="py-3 px-4 text-right">الاسم</th>
            <th className="py-3 px-4 text-right">آخر حركة</th>
            <th className="py-3 px-4 text-right">العمر</th>
            <th className="py-3 px-4 text-left">الرصيد</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-surface-2/50">
              <td className="py-3 px-4 text-xs font-bold text-ink">
                <div>{row.name}</div>
                {row.phone && <div className="text-2xs text-muted tabular-nums" dir="ltr">{row.phone}</div>}
              </td>
              <td className="py-3 px-4 text-xs text-muted tabular-nums" dir="ltr">
                {row.last_activity_date || '—'}
              </td>
              <td className="py-3 px-4">{agingBadge(row.aging_bucket)}</td>
              <td className="py-3 px-4 text-left text-xs font-black tabular-nums" dir="ltr">
                {formatCurrency(row.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    )}
  </Card>
);

export const ReceivablesPayablesTab: React.FC<ReceivablesPayablesTabProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="text-center py-16 text-sm text-muted font-medium">
        جاري تجميع أرصدة الذمم وأعمار الديون...
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const s = data.summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="ذمم العملاء المدينة لنا"
          value={<span dir="ltr">{formatCurrency(s.customer_receivables_total)}</span>}
          tone="ok"
          icon={<Users className="w-4 h-4" />}
          hint={`متأخر +60 يوم: ${formatCurrency(data.aging.customers.days_60_plus)}`}
        />
        <StatCard
          label="مستحقات شركات الشحن (COD)"
          value={<span dir="ltr">{formatCurrency(s.courier_receivables_total)}</span>}
          tone="info"
          icon={<Package className="w-4 h-4" />}
          hint={`متأخر 31–60 يوم: ${formatCurrency(data.aging.couriers.days_31_60)}`}
        />
        <StatCard
          label="مستحقات للموردين"
          value={<span dir="ltr">{formatCurrency(s.supplier_payables_total)}</span>}
          tone="bad"
          icon={<Truck className="w-4 h-4" />}
          hint={`رصيد دائن +60 يوم: ${formatCurrency(data.aging.suppliers.days_60_plus)}`}
        />
        <StatCard
          label="صافي الموقف التجاري للذمم"
          value={<span dir="ltr">{formatCurrency(s.net_trade_position)}</span>}
          tone={s.net_trade_position >= 0 ? 'ok' : 'bad'}
          icon={<Scale className="w-4 h-4" />}
          hint="لنا (عملاء + شحن) - علينا (موردين)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PartyAgingTable
          title="أكبر أرصدة العملاء المفتوحة وأعمارها"
          rows={data.top_customers}
          emptyText="لا توجد أرصدة معلقة للعملاء"
        />
        <PartyAgingTable
          title="أكبر أرصدة الموردين المفتوحة وأعمارها"
          rows={data.top_suppliers}
          emptyText="لا توجد أرصدة مستحقة للموردين"
        />
      </div>

      <PartyAgingTable
        title="أرصدة ومستحقات شركات الشحن"
        rows={data.top_couriers}
        emptyText="لا توجد أرصدة مفتوحة لدى شركات الشحن"
      />
    </div>
  );
};
