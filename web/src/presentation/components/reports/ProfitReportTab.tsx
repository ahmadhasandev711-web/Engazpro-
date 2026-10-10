import React from 'react';
import { DollarSign, Percent, ShoppingBag, Layers, ArrowUpRight, ArrowDownRight, BarChart3 } from 'lucide-react';
import { formatCurrency, ProfitReportData } from '@pos-mandob/shared';

interface ProfitReportTabProps {
  data?: ProfitReportData;
  isLoading: boolean;
}

export const ProfitReportTab: React.FC<ProfitReportTabProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return <div className="text-center py-16 text-sm text-slate-400 font-medium">جاري حساب الأرباح...</div>;
  }

  const profit = data?.profit;
  const sales = data?.sales;
  const cogs = data?.cogs;

  return (
    <div className="space-y-6">
      {/* Highlight Net Profit Banner */}
      <div
        className={`p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 ${
          (profit?.net_profit || 0) >= 0
            ? 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white border-emerald-400'
            : 'bg-gradient-to-br from-rose-500 to-red-700 text-white border-rose-400'
        }`}
      >
        <div>
          <div className="flex items-center gap-2 text-white/90 text-sm font-medium mb-1">
            <DollarSign className="w-5 h-5" />
            <span>صافي الربح الفعلي بعد خصم تكلفة البضاعة والمصروفات</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight" dir="ltr">
            {formatCurrency(profit?.net_profit || 0)}
          </h1>
        </div>

        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20">
          <div>
            <p className="text-xs text-white/80 font-medium">هامش صافي الربح</p>
            <p className="text-2xl font-black" dir="ltr">
              {profit?.profit_margin || 0}%
            </p>
          </div>
          <Percent className="w-8 h-8 text-white/60" />
        </div>
      </div>

      {/* Profit Components Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">صافي المبيعات</span>
            <ShoppingBag className="w-4 h-4 text-primary-600" />
          </div>
          <p className="text-2xl font-black text-slate-900" dir="ltr">
            {formatCurrency(sales?.net_sales || 0)}
          </p>
          <p className="text-[11px] text-slate-400">
            إجمالي {formatCurrency(sales?.gross_sales || 0)} - مرتجع {formatCurrency(sales?.sale_returns || 0)}
          </p>
        </div>

        {/* Net COGS */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">تكلفة البضاعة المباعة (COGS)</span>
            <Layers className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700" dir="ltr">
            {formatCurrency(cogs?.net_cogs || 0)}
          </p>
          <p className="text-[11px] text-slate-400">
            سعر الشراء للأصناف المباعة وقت البيع
          </p>
        </div>

        {/* Gross Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">إجمالي الربح (المبيعات - التكلفة)</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700" dir="ltr">
            {formatCurrency(profit?.gross_profit || 0)}
          </p>
          <p className="text-[11px] text-slate-400">
            الربح التجاري قبل طرح المصروفات
          </p>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">المصروفات التشغيلية</span>
            <ArrowDownRight className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-700" dir="ltr">
            {formatCurrency(profit?.total_expenses || 0)}
          </p>
          <p className="text-[11px] text-slate-400">
            عدد {profit?.expenses_count || 0} مصروفات مسجلة
          </p>
        </div>
      </div>

      {/* Step by Step Profit Formula Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary-600" />
          تفاصيل معادلة الحساب الدستورية (MasterPrompt Section 12)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <tbody className="divide-y divide-slate-100">
              <tr className="py-2.5">
                <td className="py-2.5 text-slate-600 font-medium">1. إجمالي فواتير البيع ({sales?.sales_count || 0} فاتورة)</td>
                <td className="py-2.5 font-bold text-slate-900 text-left font-mono">{formatCurrency(sales?.gross_sales || 0)}</td>
              </tr>
              <tr className="py-2.5">
                <td className="py-2.5 text-slate-600 font-medium">2. يخصم مرتجعات المبيعات ({sales?.returns_count || 0} مرتجع)</td>
                <td className="py-2.5 font-bold text-rose-600 text-left font-mono">- {formatCurrency(sales?.sale_returns || 0)}</td>
              </tr>
              <tr className="py-2.5 bg-slate-50 font-bold">
                <td className="py-2.5 text-slate-800">= صافي المبيعات (Net Sales)</td>
                <td className="py-2.5 text-slate-900 text-left font-mono">{formatCurrency(sales?.net_sales || 0)}</td>
              </tr>
              <tr className="py-2.5">
                <td className="py-2.5 text-slate-600 font-medium">3. يخصم تكلفة البضاعة المباعة (COGS)</td>
                <td className="py-2.5 font-bold text-rose-600 text-left font-mono">- {formatCurrency(cogs?.net_cogs || 0)}</td>
              </tr>
              <tr className="py-2.5 bg-emerald-50 font-bold">
                <td className="py-2.5 text-emerald-900">= إجمالي الربح (Gross Profit)</td>
                <td className="py-2.5 text-emerald-700 text-left font-mono">{formatCurrency(profit?.gross_profit || 0)}</td>
              </tr>
              <tr className="py-2.5">
                <td className="py-2.5 text-slate-600 font-medium">4. يخصم المصروفات العامة والتشغيلية</td>
                <td className="py-2.5 font-bold text-rose-600 text-left font-mono">- {formatCurrency(profit?.total_expenses || 0)}</td>
              </tr>
              <tr className="py-3 bg-primary-50 font-black text-sm text-primary-900">
                <td className="py-3">= صافي الربح النهائي (Net Profit)</td>
                <td className="py-3 text-primary-800 text-left font-mono">{formatCurrency(profit?.net_profit || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
