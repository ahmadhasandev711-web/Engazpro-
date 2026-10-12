import React, { useState } from 'react';
import {
  TrendingUp,
  Receipt,
  Package,
  Printer,
  Wallet,
  Download,
} from 'lucide-react';
import { exportCashFlowToExcel, exportProductsToExcel, exportJsonToExcel } from '../utils/excelExport';
import {
  useProfitReport,
  useSalesReport,
  useStockReport,
  useCashFlowReport,
} from '../../hooks/useReports';
import { useAuthStore } from '../../data/store/useAuthStore';
import { formatCurrency } from '@pos-mandob/shared';
import { usePermissions } from '../../hooks/usePermissions';
import { ProfitReportTab } from '../components/reports/ProfitReportTab';
import { SalesReportTab } from '../components/reports/SalesReportTab';
import { CashFlowTab } from '../components/reports/CashFlowTab';
import { StockReportTab } from '../components/reports/StockReportTab';
import { DateRangeFilter, DatePreset, calculatePresetDates } from '../components/common/DateRangeFilter';
import { MobileFilterChips, FilterChipOption } from '../components/mobile/MobileFilterChips';

type ActiveTab = 'profit' | 'sales' | 'cash-flow' | 'stock';

export const ReportsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const { canViewProfitReport } = usePermissions();
  const storeIdentity = user?.store_identity;
  const storeName = storeIdentity?.business_name || (user as any)?.store_name || user?.name || 'متجر إنجاز برو';
  const storePhone = storeIdentity?.store_phone || user?.phone;
  const storeAddress = storeIdentity?.store_address;

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => canViewProfitReport ? 'profit' : 'sales');
  const [selectedTreasury, setSelectedTreasury] = useState<'CASH' | 'CARD' | 'INSTAPAY' | 'VODAFONE_CASH' | 'TRANSFER'>('CASH');
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [fromDate, setFromDate] = useState<string>(() => {
    return calculatePresetDates('this_month').from;
  });
  const [toDate, setToDate] = useState<string>(() => {
    return calculatePresetDates('this_month').to;
  });

  // Dedicated custom hooks
  const { data: profitData, isLoading: isProfitLoading } = useProfitReport(fromDate, toDate, canViewProfitReport && activeTab === 'profit');
  const { data: salesData, isLoading: isSalesLoading } = useSalesReport(fromDate, toDate, activeTab === 'sales');
  const { data: stockData, isLoading: isStockLoading } = useStockReport(activeTab === 'stock');
  const { data: cashFlowData, isLoading: isCashFlowLoading } = useCashFlowReport(fromDate, toDate, activeTab === 'cash-flow');

  const handleExportCurrentTab = () => {
    if (activeTab === 'cash-flow' && cashFlowData) {
      exportCashFlowToExcel(cashFlowData, fromDate || 'البداية', toDate || 'اليوم');
    } else if (activeTab === 'stock' && stockData?.products) {
      exportProductsToExcel(stockData.products);
    } else if (activeTab === 'profit' && canViewProfitReport && profitData) {
      const summary = profitData.summary || {};
      const rows = [
        { 'البند': 'إجمالي المبيعات', 'المبلغ': summary.gross_sales || 0 },
        { 'البند': 'مرتجعات المبيعات', 'المبلغ': summary.sales_returns || 0 },
        { 'البند': 'صافي المبيعات', 'المبلغ': summary.net_sales || 0 },
        { 'البند': 'تكلفة البضاعة المباعة (COGS)', 'المبلغ': summary.cost_of_goods_sold || 0 },
        { 'البند': 'إجمالي الربح التجاري', 'المبلغ': summary.gross_profit || 0 },
        { 'البند': 'إجمالي المصروفات', 'المبلغ': summary.total_expenses || 0 },
        { 'البند': 'صافي الربح النهائي', 'المبلغ': summary.net_profit || 0 },
      ];
      exportJsonToExcel(rows, `تقرير_الأرباح_${fromDate}_${toDate}`, 'الأرباح والخسائر');
    } else if (activeTab === 'sales' && salesData?.top_selling_products) {
      const rows = (salesData.top_selling_products || []).map((p: any, idx: number) => ({
        'م': idx + 1,
        'الصنف': p.name,
        'الكمية المباعة': p.total_quantity,
        'إجمالي الإيراد': p.total_revenue,
      }));
      exportJsonToExcel(rows, `تقرير_المبيعات_${fromDate}_${toDate}`, 'المبيعات');
    }
  };

  const reportFilterChips: FilterChipOption<ActiveTab>[] = [
    ...(canViewProfitReport
      ? [{ id: 'profit' as const, label: 'الأرباح والخسائر', icon: TrendingUp }]
      : []),
    { id: 'sales' as const, label: 'المبيعات', icon: Receipt },
    { id: 'cash-flow' as const, label: 'الخزينة والنقدية', icon: Wallet },
    { id: 'stock' as const, label: 'تقييم المخزون', icon: Package },
  ];

  return (
    <>
      <div className="space-y-3 sm:space-y-6 no-print" dir="rtl">
      {/* Desktop Header */}
      <div className="hidden md:flex flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {canViewProfitReport ? 'التقارير والأرباح والمخزون' : 'تقارير المبيعات والخزينة والمخزون'}
          </h2>
          <p className="text-sm text-slate-500">
            {canViewProfitReport
              ? 'متابعة حركة المبيعات، تكلفة البضاعة المباعة، المصروفات، وصافي الأرباح الحقيقية'
              : 'متابعة حركة المبيعات، المصروفات، حركة الخزينة، والمخزون'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCurrentTab}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors"
            title="تصدير التقرير الحالي إلى Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            تصدير Excel
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            طباعة التقرير
          </button>
        </div>
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className="md:hidden bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-900 truncate">
              {canViewProfitReport ? 'التقارير والأرباح' : 'تقارير المبيعات'}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              متابعة الأداء والمؤشرات المالية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleExportCurrentTab}
            className="p-2 bg-slate-100 active:bg-slate-200 text-slate-700 rounded-xl active:scale-95 transition-all"
            title="تصدير Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
          </button>
          <button
            onClick={() => window.print()}
            className="p-2 bg-slate-800 active:bg-slate-900 text-white rounded-xl active:scale-95 transition-all"
            title="طباعة التقرير"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Filter Chips */}
      <div className="md:hidden w-full overflow-hidden">
        <MobileFilterChips
          options={reportFilterChips}
          selectedId={activeTab}
          onSelect={(id) => setActiveTab(id)}
        />
      </div>

      {/* Desktop Tabs (Horizontal Scroll Track - hidden md:flex) */}
      <div className="hidden md:flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth flex-nowrap text-xs border-b border-slate-200">
        {canViewProfitReport && (
          <button
            onClick={() => setActiveTab('profit')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'profit'
                ? 'bg-primary-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>الأرباح والخسائر</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'sales'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>المبيعات</span>
        </button>
        <button
          onClick={() => setActiveTab('cash-flow')}
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'cash-flow'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>الخزينة والنقدية</span>
        </button>
        <button
          onClick={() => setActiveTab('stock')}
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'stock'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>تقييم المخزون</span>
        </button>
      </div>

      {/* Date Filter Bar (Shown for Profit, Sales, CashFlow) */}
      {activeTab !== 'stock' && (
        <div className="bg-white p-2.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs w-full min-w-0 max-w-full overflow-hidden">
          <DateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            defaultPreset="this_month"
            onChange={(from, to, newPreset) => {
              setFromDate(from);
              setToDate(to);
              setPreset(newPreset);
            }}
          />
        </div>
      )}

      {/* Tab Panels */}
      {activeTab === 'profit' && canViewProfitReport && <ProfitReportTab data={profitData} isLoading={isProfitLoading} />}
      {activeTab === 'sales' && <SalesReportTab data={salesData} isLoading={isSalesLoading} />}
      {activeTab === 'cash-flow' && (
        <CashFlowTab
          data={cashFlowData}
          isLoading={isCashFlowLoading}
          selectedTreasury={selectedTreasury}
          onSelectTreasury={setSelectedTreasury}
          preset={preset}
        />
      )}
      {activeTab === 'stock' && <StockReportTab data={stockData} isLoading={isStockLoading} />}
      </div>

      {/* ========================================================================= */}
      {/* Dedicated Official Corporate Printable Report (Rendered only during print) */}
      {/* ========================================================================= */}
      <div className="print-only printable-area font-sans text-slate-900 leading-relaxed text-xs" dir="rtl">
        {/* Official Store Letterhead */}
        <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-black text-slate-900">{storeName}</h1>
            <p className="text-xs font-bold text-slate-600">نظام إنجاز برو لإدارة نقاط البيع والمخازن</p>
            {storePhone && <p className="text-[11px] text-slate-500 font-mono">الهاتف: {storePhone}</p>}
            {storeAddress && <p className="text-[11px] text-slate-500">{storeAddress}</p>}
          </div>

          <div className="text-left space-y-1">
            <div className="inline-block bg-slate-900 text-white font-black px-3 py-1 rounded text-sm">
              {activeTab === 'profit' && 'تقرير الأرباح والخسائر الشامل'}
              {activeTab === 'sales' && 'كشف حركة المبيعات والمتحصلات'}
              {activeTab === 'cash-flow' && 'كشف الحصيلة والتدفقات النقدية'}
              {activeTab === 'stock' && 'تقرير جرد وتقييم المخزون'}
            </div>
            {activeTab !== 'stock' && (
              <p className="text-[11px] text-slate-600 font-mono">
                الفترة: من {fromDate || 'البداية'} إلى {toDate || 'اليوم'}
              </p>
            )}
            <p className="text-[10px] text-slate-400 font-mono">
              تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG')}
            </p>
            <p className="text-[10px] text-slate-400">
              المستخدم: {user?.name}
            </p>
          </div>
        </div>

        {/* Tab 1: Profit Report Table */}
        {activeTab === 'profit' && profitData && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-slate-900 border-b border-slate-300 pb-1">
              قائمة الدخل والأرباح التشغيلية
            </h2>
            <table className="w-full text-right border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr className="border-b border-slate-200 bg-slate-50 font-bold">
                  <td className="p-2 border border-slate-300">إجمالي المبيعات (Gross Sales)</td>
                  <td className="p-2 border border-slate-300 font-mono text-left font-black">{formatCurrency(profitData.sales?.gross_sales || 0)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 border border-slate-300 pr-6">├─ مبيعات أصناف المنتجات</td>
                  <td className="p-2 border border-slate-300 font-mono text-left">{formatCurrency((profitData.sales as any)?.product_sales ?? profitData.sales?.gross_sales ?? 0)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 border border-slate-300 pr-6">├─ إيرادات خدمات الشحن والتوصيل المحصلة</td>
                  <td className="p-2 border border-slate-300 font-mono text-left font-bold text-indigo-700">{formatCurrency((profitData.sales as any)?.shipping_revenue ?? 0)}</td>
                </tr>
                {Number((profitData.sales as any)?.discounts || 0) > 0 && (
                  <tr className="border-b border-slate-200 text-rose-700">
                    <td className="p-2 border border-slate-300 pr-6">├─ الخصومات الممنوحة على الفواتير (-)</td>
                    <td className="p-2 border border-slate-300 font-mono text-left">-{formatCurrency((profitData.sales as any)?.discounts || 0)}</td>
                  </tr>
                )}
                <tr className="border-b border-slate-200 text-rose-700">
                  <td className="p-2 border border-slate-300 pr-6">└─ مرتجعات المبيعات (-)</td>
                  <td className="p-2 border border-slate-300 font-mono text-left">-{formatCurrency(profitData.sales?.sale_returns || 0)}</td>
                </tr>
                <tr className="border-b border-slate-300 bg-slate-100 font-black">
                  <td className="p-2 border border-slate-300">= صافي المبيعات (Net Sales)</td>
                  <td className="p-2 border border-slate-300 font-mono text-left text-sm">{formatCurrency(profitData.sales?.net_sales || 0)}</td>
                </tr>
                <tr className="border-b border-slate-200 text-rose-800">
                  <td className="p-2 border border-slate-300">تكلفة البضاعة المباعة (COGS) (-)</td>
                  <td className="p-2 border border-slate-300 font-mono text-left font-bold">-{formatCurrency(profitData.cogs?.net_cogs || 0)}</td>
                </tr>
                <tr className="border-b border-slate-300 bg-slate-100 font-black">
                  <td className="p-2 border border-slate-300">= إجمالي الربح التجاري (Gross Profit)</td>
                  <td className="p-2 border border-slate-300 font-mono text-left text-sm text-emerald-800">{formatCurrency(profitData.profit?.gross_profit || 0)}</td>
                </tr>
                <tr className="border-b border-slate-200 text-rose-800">
                  <td className="p-2 border border-slate-300">إجمالي المصروفات التشغيلية واليومية (-)</td>
                  <td className="p-2 border border-slate-300 font-mono text-left font-bold">-{formatCurrency(profitData.profit?.total_expenses || 0)}</td>
                </tr>
                <tr className="border-2 border-slate-900 bg-slate-100 font-black text-sm">
                  <td className="p-2.5 border border-slate-900">= صافي الربح الفعلي النهائي (Net Profit)</td>
                  <td className="p-2.5 border border-slate-900 font-mono text-left text-base text-emerald-800">{formatCurrency(profitData.profit?.net_profit || 0)}</td>
                </tr>
                <tr className="border-b border-slate-300 font-bold bg-slate-50">
                  <td className="p-2 border border-slate-300">نسبة هامش صافي الربح (%)</td>
                  <td className="p-2 border border-slate-300 font-mono text-left font-bold">{profitData.profit?.profit_margin || 0}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Sales Report Table */}
        {activeTab === 'sales' && salesData && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-slate-900 border-b border-slate-300 pb-1">
              ملخص إحصائيات المبيعات والمتحصلات
            </h2>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="border border-slate-300 p-2 bg-slate-50">
                <span className="text-[10px] text-slate-500 block">إجمالي المبيعات:</span>
                <span className="font-mono font-black text-xs">{formatCurrency(salesData.total_sales || 0)}</span>
              </div>
              <div className="border border-slate-300 p-2 bg-slate-50">
                <span className="text-[10px] text-slate-500 block">المبالغ المحصلة (مدفوعة):</span>
                <span className="font-mono font-black text-xs text-emerald-700">{formatCurrency(salesData.sales_paid || 0)}</span>
              </div>
              <div className="border border-slate-300 p-2 bg-slate-50">
                <span className="text-[10px] text-slate-500 block">المتبقي (آجل):</span>
                <span className="font-mono font-black text-xs text-rose-700">{formatCurrency(salesData.sales_remaining || 0)}</span>
              </div>
            </div>

            {/* Payment breakdown */}
            {salesData.payment_methods && salesData.payment_methods.length > 0 && (
              <div>
                <h3 className="text-xs font-black text-slate-700 mb-1">تفصيل طرق الدفع:</h3>
                <table className="w-full text-right border border-slate-300 text-xs">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="p-2 border border-slate-300">طريقة الدفع</th>
                      <th className="p-2 border border-slate-300 text-center">عدد الفواتير</th>
                      <th className="p-2 border border-slate-300 text-left">إجمالي المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.payment_methods.map((pm: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="p-2 border border-slate-300 font-bold">
                          {pm.payment_method === 'CASH' ? 'نقدي (كاش)' :
                           pm.payment_method === 'CARD' ? 'بطاقة / فيزا' :
                           pm.payment_method === 'INSTAPAY' ? 'إنستاباي (InstaPay)' :
                           pm.payment_method === 'VODAFONE_CASH' ? 'فودافون كاش ومحافظ' :
                           pm.payment_method === 'SPLIT' ? 'دفع مجزأ' :
                           pm.payment_method === 'TRANSFER' ? 'تحويل بنكي' : 'آجل على الحساب'}
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-mono">{pm.count}</td>
                        <td className="p-2 border border-slate-300 text-left font-mono font-bold">{formatCurrency(pm.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Cash Flow Report Table */}
        {activeTab === 'cash-flow' && cashFlowData && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-slate-900 border-b border-slate-300 pb-1">
              كشف حركة الحصيلة النقدية والخزن
            </h2>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="border border-slate-300 p-2 bg-emerald-50">
                <span className="text-[10px] text-emerald-700 block">إجمالي المقبوضات (+):</span>
                <span className="font-mono font-black text-xs text-emerald-800">{formatCurrency(cashFlowData.inflow?.total || 0)}</span>
              </div>
              <div className="border border-slate-300 p-2 bg-rose-50">
                <span className="text-[10px] text-rose-700 block">إجمالي المدفوعات (-):</span>
                <span className="font-mono font-black text-xs text-rose-800">{formatCurrency(cashFlowData.outflow?.total || 0)}</span>
              </div>
              <div className="border border-slate-300 p-2 bg-slate-100">
                <span className="text-[10px] text-slate-600 block">صافي التدفق النقدي:</span>
                <span className="font-mono font-black text-xs">{formatCurrency(cashFlowData.net_cash_flow || 0)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Stock Report Table */}
        {activeTab === 'stock' && stockData && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-slate-900 border-b border-slate-300 pb-1">
              تقرير تقييم وجرد المخزون
            </h2>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="border border-slate-300 p-2 bg-slate-50">
                <span className="text-[10px] text-slate-500 block">إجمالي عدد القطع:</span>
                <span className="font-mono font-black text-xs">{stockData.summary?.total_quantity || 0}</span>
              </div>
              <div className="border border-slate-300 p-2 bg-slate-50">
                <span className="text-[10px] text-slate-500 block">تقييم المخزون بسعر الشراء (التكلفة):</span>
                <span className="font-mono font-black text-xs text-slate-800">{formatCurrency(stockData.summary?.total_cost_value || 0)}</span>
              </div>
              <div className="border border-slate-300 p-2 bg-slate-50">
                <span className="text-[10px] text-slate-500 block">تقييم المخزون بسعر البيع (القطاعي):</span>
                <span className="font-mono font-black text-xs text-emerald-800">{formatCurrency(stockData.summary?.total_retail_value || 0)}</span>
              </div>
            </div>

            {/* Products Table */}
            {stockData.products && stockData.products.length > 0 && (
              <table className="w-full text-right border border-slate-300 text-[11px]">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="p-1.5 border border-slate-300">م</th>
                    <th className="p-1.5 border border-slate-300">الصنف</th>
                    <th className="p-1.5 border border-slate-300 text-center">الرصيد</th>
                    <th className="p-1.5 border border-slate-300 text-left">سعر البيع</th>
                    <th className="p-1.5 border border-slate-300 text-left">قيمة البيع</th>
                  </tr>
                </thead>
                <tbody>
                  {stockData.products.map((p: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-1.5 border border-slate-300 font-mono">{idx + 1}</td>
                      <td className="p-1.5 border border-slate-300 font-bold">{p.name} ({p.code || p.barcode || '-'})</td>
                      <td className="p-1.5 border border-slate-300 text-center font-mono font-bold">{p.quantity}</td>
                      <td className="p-1.5 border border-slate-300 text-left font-mono">{formatCurrency(p.sale_price)}</td>
                      <td className="p-1.5 border border-slate-300 text-left font-mono font-bold">{formatCurrency(p.retail_value ?? (p.sale_price * p.quantity))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Formal Approval Signatures & Stamp */}
        <div className="pt-10 mt-8 border-t-2 border-slate-300 grid grid-cols-3 text-center text-xs">
          <div className="space-y-8">
            <p className="font-bold text-slate-700">توقيع المحاسب المالي</p>
            <p className="text-slate-400 font-mono">...................................</p>
          </div>
          <div className="space-y-8">
            <p className="font-bold text-slate-700">اعتماد الإدارة العامة</p>
            <p className="text-slate-400 font-mono">...................................</p>
          </div>
          <div className="space-y-8">
            <p className="font-bold text-slate-700">خاتم المنشأة</p>
            <div className="w-20 h-20 border border-dashed border-slate-300 rounded-full mx-auto" />
          </div>
        </div>
      </div>
    </>
  );
};
