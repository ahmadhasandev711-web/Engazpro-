import React from 'react';
import {
  DollarSign,
  Percent,
  ShoppingBag,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from 'lucide-react';
import { formatCurrency, ProfitReportData } from '@pos-mandob/shared';
import { Card, DataTable, StatCard } from '../ui';

interface ProfitReportTabProps {
  data?: ProfitReportData;
  isLoading: boolean;
}

export const ProfitReportTab: React.FC<ProfitReportTabProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="text-center py-16 text-sm text-muted font-medium">جاري حساب الأرباح...</div>
    );
  }

  const profit = data?.profit;
  const sales = data?.sales;
  const cogs = data?.cogs;

  return (
    <div className="space-y-6">
      {/* Highlight Net Profit Banner */}
      <div
        className={`p-6 rounded-3xl border shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 ${
          (profit?.net_profit || 0) >= 0
            ? 'bg-ok text-on-brand border-ok'
            : 'bg-bad text-on-brand border-bad'
        }`}
      >
        <div>
          <div className="flex items-center gap-2 text-on-brand/90 text-sm font-medium mb-1">
            <DollarSign className="w-5 h-5" />
            <span>صافي الربح الفعلي بعد خصم تكلفة البضاعة والمصروفات</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight tabular-nums" dir="ltr">
            {formatCurrency(profit?.net_profit || 0)}
          </h1>
        </div>

        <div className="flex items-center gap-4 bg-canvas/15 backdrop-blur-md px-5 py-3 rounded-2xl border border-canvas/20">
          <div>
            <p className="text-xs text-on-brand/80 font-medium">هامش صافي الربح</p>
            <p className="text-2xl font-black tabular-nums" dir="ltr">
              {profit?.profit_margin || 0}%
            </p>
          </div>
          <Percent className="w-8 h-8 text-on-brand/70" />
        </div>
      </div>

      {/* Profit Components Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Sales */}
        <StatCard
          label="صافي المبيعات"
          value={<span dir="ltr">{formatCurrency(sales?.net_sales || 0)}</span>}
          tone="brand"
          icon={<ShoppingBag className="w-4 h-4" />}
          hint={`إجمالي ${formatCurrency(sales?.gross_sales || 0)} - مرتجع ${formatCurrency(
            sales?.sale_returns || 0
          )}`}
        />

        {/* Net COGS */}
        <StatCard
          label="تكلفة البضاعة المباعة (COGS)"
          value={<span dir="ltr">{formatCurrency(cogs?.net_cogs || 0)}</span>}
          tone="warn"
          icon={<Layers className="w-4 h-4" />}
          hint="سعر الشراء للأصناف المباعة وقت البيع"
        />

        {/* Gross Profit */}
        <StatCard
          label="إجمالي الربح (المبيعات - التكلفة)"
          value={<span dir="ltr">{formatCurrency(profit?.gross_profit || 0)}</span>}
          tone="ok"
          icon={<ArrowUpRight className="w-4 h-4" />}
          hint="الربح التجاري قبل طرح المصروفات"
        />

        {/* Total Expenses */}
        <StatCard
          label="المصروفات التشغيلية"
          value={<span dir="ltr">{formatCurrency(profit?.total_expenses || 0)}</span>}
          tone="bad"
          icon={<ArrowDownRight className="w-4 h-4" />}
          hint={`عدد ${profit?.expenses_count || 0} مصروفات مسجلة`}
        />
      </div>

      {/* Step by Step Profit Formula Card */}
      <Card className="p-6 space-y-4">
        <h3 className="font-bold text-sm text-ink flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-brand" />
          تفاصيل معادلة الحساب الدستورية (MasterPrompt Section 12)
        </h3>

        <DataTable className="border-0 rounded-xl shadow-none">
          <tbody className="divide-y divide-line text-xs">
            <tr>
              <td className="py-2.5 px-3 text-muted font-medium">
                1. إجمالي فواتير البيع ({sales?.sales_count || 0} فاتورة)
              </td>
              <td className="py-2.5 px-3 font-bold text-ink text-left tabular-nums">
                {formatCurrency(sales?.gross_sales || 0)}
              </td>
            </tr>
            <tr>
              <td className="py-2.5 px-3 text-muted font-medium">
                2. يخصم مرتجعات المبيعات ({sales?.returns_count || 0} مرتجع)
              </td>
              <td className="py-2.5 px-3 font-bold text-bad text-left tabular-nums">
                - {formatCurrency(sales?.sale_returns || 0)}
              </td>
            </tr>
            <tr className="bg-surface-2 font-bold">
              <td className="py-2.5 px-3 text-ink">= صافي المبيعات (Net Sales)</td>
              <td className="py-2.5 px-3 text-ink text-left tabular-nums">
                {formatCurrency(sales?.net_sales || 0)}
              </td>
            </tr>
            <tr>
              <td className="py-2.5 px-3 text-muted font-medium">
                3. يخصم تكلفة البضاعة المباعة (COGS)
              </td>
              <td className="py-2.5 px-3 font-bold text-bad text-left tabular-nums">
                - {formatCurrency(cogs?.net_cogs || 0)}
              </td>
            </tr>
            <tr className="bg-ok-soft font-bold">
              <td className="py-2.5 px-3 text-ok">= إجمالي الربح (Gross Profit)</td>
              <td className="py-2.5 px-3 text-ok text-left tabular-nums">
                {formatCurrency(profit?.gross_profit || 0)}
              </td>
            </tr>
            <tr>
              <td className="py-2.5 px-3 text-muted font-medium">
                4. يخصم المصروفات العامة والتشغيلية
              </td>
              <td className="py-2.5 px-3 font-bold text-bad text-left tabular-nums">
                - {formatCurrency(profit?.total_expenses || 0)}
              </td>
            </tr>
            <tr className="bg-brand-soft font-black text-sm text-brand-ink">
              <td className="py-3 px-3">= صافي الربح النهائي (Net Profit)</td>
              <td className="py-3 px-3 text-brand-ink text-left tabular-nums">
                {formatCurrency(profit?.net_profit || 0)}
              </td>
            </tr>
          </tbody>
        </DataTable>
      </Card>
    </div>
  );
};
