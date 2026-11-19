import React from 'react';
import {
  TrendingUp,
  Landmark,
  Wallet,
  Package,
  Truck,
  Scale,
  Receipt,
} from 'lucide-react';
import { FinancialClosingReportData, formatCurrency } from '@pos-mandob/shared';
import { Card, StatCard } from '../ui';
import { StatementSectionCard, StatementLineRow } from './StatementSectionCard';

interface FinancialClosingTabProps {
  data?: FinancialClosingReportData;
  isLoading: boolean;
}

export const FinancialClosingTab: React.FC<FinancialClosingTabProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="text-center py-16 text-sm text-muted font-medium">
        جاري إعداد القوائم المالية الختامية...
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const pnl = data.income_statement;
  const bal = data.balance_snapshot;

  const pnlRows: StatementLineRow[] = [
    { label: 'إجمالي المبيعات', amount: pnl.gross_sales, tone: 'ok' },
    { label: 'الخصومات الممنوحة على الفواتير', amount: -pnl.sales_discounts, tone: 'warn' },
    { label: 'مرتجعات المبيعات', amount: -pnl.sale_returns, tone: 'bad' },
    { label: 'صافي إيرادات المبيعات', amount: pnl.net_sales, tone: 'brand', isTotal: true },
    { label: 'صافي تكلفة البضاعة المباعة (COGS)', amount: -pnl.net_cogs, tone: 'warn', hint: `تكلفة المبيعات ${formatCurrency(pnl.cogs_sales)} - تكلفة المرتجع ${formatCurrency(pnl.cogs_returns)}` },
    { label: 'مجمل الربح التجاري', amount: pnl.gross_profit, tone: pnl.gross_profit >= 0 ? 'ok' : 'bad', hint: `هامش مجمل الربح: ${pnl.gross_margin}%`, isTotal: true },
    ...pnl.expenses_by_category.map((cat) => ({
      label: `مصروفات: ${cat.category}`,
      amount: -cat.total_amount,
      hint: `${cat.count} حركة مسجلة`,
      tone: 'bad' as const,
    })),
    { label: 'إجمالي المصروفات التشغيلية (شاملة الرواتب المنصرفة)', amount: -pnl.total_expenses, tone: 'bad', isTotal: true },
    { label: 'صافي الربح النهائي للفترة', amount: pnl.net_profit, tone: pnl.net_profit >= 0 ? 'ok' : 'bad', hint: `هامش صافي الربح: ${pnl.net_margin}%`, isTotal: true },
  ];

  const assetRows: StatementLineRow[] = [
    ...bal.assets.treasuries_by_type.map((t) => ({
      label: t.label,
      amount: t.balance,
      tone: t.balance >= 0 ? ('ok' as const) : ('bad' as const),
    })),
    { label: 'إجمالي السيولة النقدية والبنوك والمحافظ', amount: bal.assets.total_cash_and_banks, tone: 'brand', isTotal: true },
    { label: 'قيمة المخزون الفعلي بالتكلفة', amount: bal.assets.inventory_cost_value, tone: 'ok' },
    { label: 'بضاعة بالطريق (تحويلات مخزنية قيد التسليم)', amount: bal.assets.in_transit_inventory_value, tone: 'warn' },
    { label: 'ذمم ومستحقات عند العملاء', amount: bal.assets.customer_receivables, tone: 'ok' },
    { label: 'مستحقات تحصيل COD عند شركات الشحن', amount: bal.assets.courier_receivables, tone: 'ok' },
    { label: 'إجمالي الأصول التشغيلية', amount: bal.assets.total_assets, tone: 'brand', isTotal: true },
  ];

  const liabilityRows: StatementLineRow[] = [
    { label: 'مستحقات للموردين', amount: bal.liabilities.supplier_payables, tone: 'bad' },
    { label: 'أرصدة دائنة للعملاء', amount: bal.liabilities.customer_credits, tone: 'warn' },
    { label: 'مستحقات لشركات الشحن', amount: bal.liabilities.courier_payables, tone: 'bad' },
    { label: 'إجمالي الالتزامات التشغيلية', amount: bal.liabilities.total_liabilities, tone: 'bad', isTotal: true },
    { label: 'صافي رأس المال العامل والمركز المالي', amount: bal.net_working_capital, tone: bal.net_working_capital >= 0 ? 'ok' : 'bad', isTotal: true },
    { label: 'مسحوبات الشركاء / المالك الشخصية (مرجع منفصل)', amount: bal.owner_drawings_total, tone: 'warn' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="صافي الربح النهائي"
          value={<span dir="ltr">{formatCurrency(pnl.net_profit)}</span>}
          tone={pnl.net_profit >= 0 ? 'ok' : 'bad'}
          icon={<TrendingUp className="w-4 h-4" />}
          hint={`هامش صافي الربح ${pnl.net_margin}%`}
        />
        <StatCard
          label="إجمالي الأصول التشغيلية"
          value={<span dir="ltr">{formatCurrency(bal.assets.total_assets)}</span>}
          tone="brand"
          icon={<Landmark className="w-4 h-4" />}
          hint={`سيولة + مخزون + ذمم مدينة`}
        />
        <StatCard
          label="إجمالي الالتزامات"
          value={<span dir="ltr">{formatCurrency(bal.liabilities.total_liabilities)}</span>}
          tone="warn"
          icon={<Receipt className="w-4 h-4" />}
          hint="مستحقات الموردين والائتمان"
        />
        <StatCard
          label="صافي رأس المال العامل"
          value={<span dir="ltr">{formatCurrency(bal.net_working_capital)}</span>}
          tone={bal.net_working_capital >= 0 ? 'ok' : 'bad'}
          icon={<Scale className="w-4 h-4" />}
          hint={
            pnl.pending_payroll_reference
              ? `رواتب شهر ${pnl.pending_payroll_reference.month} المصروفة: ${formatCurrency(pnl.pending_payroll_reference.disbursed_this_month)}`
              : undefined
          }
        />
      </div>

      <StatementSectionCard
        title="قائمة الدخل الختامية التفصيلية (Income Statement / P&L)"
        subtitle="إيرادات الفترة، تكلفة البضاعة المباعة، وتفصيل المصروفات حسب التصنيف بدون ازدواجية"
        icon={<TrendingUp className="w-5 h-5 text-brand" />}
        rows={pnlRows}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatementSectionCard
          title="الأصول والموجودات التشغيلية (Assets)"
          subtitle="القيمة الدفترية الحالية بالخزائن والمخزون والسوق"
          icon={<Wallet className="w-5 h-5 text-ok" />}
          rows={assetRows}
        />
        <StatementSectionCard
          title="الالتزامات وصافي المركز المالي (Liabilities & Equity)"
          subtitle="المستحقات للغير وصافي القيمة التشغيلية للنشاط"
          icon={<Package className="w-5 h-5 text-warn" />}
          rows={liabilityRows}
        />
      </div>

      <Card className="p-4 bg-surface-2/50 border-line flex items-center gap-3 text-xs text-muted">
        <Truck className="w-4 h-4 text-brand shrink-0" />
        <span>
          تشمل قيمة الأصول الحالية بضاعة التحويلات قيد التوصيل بين الفروع ({formatCurrency(bal.assets.in_transit_inventory_value)}) ومستحقات COD عند شركات الشحن ({formatCurrency(bal.assets.courier_receivables)}).
        </span>
      </Card>
    </div>
  );
};
