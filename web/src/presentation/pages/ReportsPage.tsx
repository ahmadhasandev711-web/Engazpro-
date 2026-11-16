import React, { useState } from 'react';
import {
  TrendingUp,
  Receipt,
  Package,
  Printer,
  Wallet,
  Download,
  ShoppingBag,
} from 'lucide-react';

import {
  useProfitReport,
  useSalesReport,
  usePurchaseReport,
  useStockReport,
  useCashFlowReport,
  fetchAllCashFlowTransactions,
} from '../../hooks/useReports';
import { useAuthStore } from '../../data/store/useAuthStore';
import { formatCurrency } from '@pos-mandob/shared';
import { usePermissions } from '../../hooks/usePermissions';
import { ProfitReportTab } from '../components/reports/ProfitReportTab';
import { SalesReportTab } from '../components/reports/SalesReportTab';
import { PurchaseReportTab } from '../components/reports/PurchaseReportTab';
import { CashFlowTab, CashFlowPrintData } from '../components/reports/CashFlowTab';
import { StockReportTab } from '../components/reports/StockReportTab';
import { DateRangeFilter, DatePreset, calculatePresetDates } from '../components/common/DateRangeFilter';
import { useToast } from '../context/ToastContext';
import { Button, Card, PageHeader, Tabs } from '../components/ui';

type ActiveTab = 'profit' | 'sales' | 'purchases' | 'cash-flow' | 'stock';

const getTreasuryLabel = (t: string) => {
  switch (t) {
    case 'CASH':
      return 'متحصلات المبيعات النقدية (الكاش)';
    case 'CARD':
      return 'متحصلات البطاقة (POS)';
    case 'INSTAPAY':
      return 'متحصلات إنستاباي (InstaPay)';
    case 'VODAFONE_CASH':
      return 'متحصلات فودافون كاش والمحافظ';
    case 'TRANSFER':
      return 'متحصلات التحويلات البنكية المباشرة';
    default:
      return t;
  }
};

const getPresetLabel = (p: DatePreset | string) => {
  switch (p) {
    case 'today':
      return 'اليوم';
    case 'yesterday':
      return 'أمس';
    case 'this_week':
      return 'هذا الأسبوع';
    case 'this_month':
      return 'هذا الشهر';
    case 'last_30_days':
      return 'آخر 30 يوم';
    case 'custom':
      return 'نطاق مخصص';
    default:
      return p;
  }
};

export const ReportsPage: React.FC = () => {
  const toast = useToast();
  const user = useAuthStore((state) => state.user);
  const { canViewProfitReport, canViewPurchaseReport } = usePermissions();
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
  const [stockPage, setStockPage] = useState(1);
  const [stockSearch, setStockSearch] = useState('');
  const { data: profitData, isLoading: isProfitLoading } = useProfitReport(fromDate, toDate, canViewProfitReport && activeTab === 'profit');
  const { data: salesData, isLoading: isSalesLoading } = useSalesReport(fromDate, toDate, activeTab === 'sales');
  const { data: purchaseData, isLoading: isPurchaseLoading } = usePurchaseReport(
    fromDate,
    toDate,
    canViewPurchaseReport && activeTab === 'purchases'
  );
  const { data: stockData, isLoading: isStockLoading, isFetching: isStockFetching } = useStockReport(
    { page: stockPage, search: stockSearch },
    activeTab === 'stock'
  );
  const { data: cashFlowData, isLoading: isCashFlowLoading } = useCashFlowReport(fromDate, toDate, activeTab === 'cash-flow');

  const [cashFlowPrintData, setCashFlowPrintData] = useState<CashFlowPrintData | null>(null);
  const [isTopPrinting, setIsTopPrinting] = useState(false);

  const handlePrintReport = async () => {
    if (activeTab === 'cash-flow') {
      // If transactions are not yet prepared or for a different treasury, fetch up to 200 items
      if (!cashFlowPrintData || cashFlowPrintData.transactions.length === 0) {
        setIsTopPrinting(true);
        try {
          const res = await fetchAllCashFlowTransactions({
            channel: selectedTreasury,
            fromDate,
            toDate,
            perPage: 200,
          });
          setCashFlowPrintData({
            treasuryName: getTreasuryLabel(selectedTreasury),
            transactions: res.data || [],
            flowFilter: 'ALL',
            preset,
            fromDate,
            toDate,
          });
          setTimeout(() => {
            window.print();
            setIsTopPrinting(false);
          }, 100);
          return;
        } catch (err) {
          console.error('Failed to fetch transactions for print:', err);
          setIsTopPrinting(false);
        }
      }
    }
    window.print();
  };

  const handleExportCurrentTab = async () => {
    try {
      const { exportCashFlowToExcel, exportProductsToExcel, exportJsonToExcel } = await import('../utils/excelExport');
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
    } else if (activeTab === 'purchases' && canViewPurchaseReport && purchaseData?.top_suppliers) {
      const rows = purchaseData.top_suppliers.map((s, idx) => ({
        'م': idx + 1,
        'المورد': s.supplier_name,
        'عدد الفواتير': s.invoices_count,
        'إجمالي المشتريات': s.total_amount,
        'المدفوع': s.paid_amount,
        'المتبقي': s.remaining_amount,
      }));
      exportJsonToExcel(rows, `تقرير_المشتريات_${fromDate}_${toDate}`, 'المشتريات والموردين');
    }
  } catch (err) {
    console.error('Excel load failed:', err);
    toast.error('تعذر تحميل أداة Excel، تأكد من الاتصال وحاول مرة أخرى');
  }
};

  const reportTabs = [
    ...(canViewProfitReport
      ? [{ id: 'profit', label: 'الأرباح والخسائر', icon: <TrendingUp className="w-4 h-4" /> }]
      : []),
    { id: 'sales', label: 'المبيعات', icon: <Receipt className="w-4 h-4" /> },
    ...(canViewPurchaseReport
      ? [{ id: 'purchases', label: 'المشتريات والموردين', icon: <ShoppingBag className="w-4 h-4" /> }]
      : []),
    { id: 'cash-flow', label: 'الخزينة والنقدية', icon: <Wallet className="w-4 h-4" /> },
    { id: 'stock', label: 'تقييم المخزون', icon: <Package className="w-4 h-4" /> },
  ];

  return (
    <>
      <div className="space-y-3 sm:space-y-6 no-print" dir="rtl">
      {/* Desktop Header */}
      <PageHeader
        title={canViewProfitReport ? 'التقارير والأرباح والمخزون' : 'تقارير المبيعات والخزينة والمخزون'}
        description={
          canViewProfitReport
            ? 'متابعة حركة المبيعات، تكلفة البضاعة المباعة، المصروفات، وصافي الأرباح الحقيقية'
            : 'متابعة حركة المبيعات، المصروفات، حركة الخزينة، والمخزون'
        }
        className="hidden md:flex mb-0"
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleExportCurrentTab}
              leftIcon={<Download className="w-4 h-4 text-ok" />}
              title="تصدير التقرير الحالي إلى Excel"
              className="text-xs font-bold"
            >
              تصدير Excel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handlePrintReport}
              disabled={isTopPrinting}
              isLoading={isTopPrinting}
              leftIcon={!isTopPrinting ? <Printer className="w-4 h-4" /> : undefined}
              className="text-xs font-bold"
            >
              طباعة التقرير
            </Button>
          </>
        }
      />

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <Card className="md:hidden p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-ok-soft text-ok flex items-center justify-center font-black shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-ink truncate">
              {canViewProfitReport ? 'التقارير والأرباح' : 'تقارير المبيعات'}
            </h2>
            <p className="text-xs text-muted font-medium truncate">
              متابعة الأداء والمؤشرات المالية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleExportCurrentTab}
            className="min-w-[44px] px-2.5"
            title="تصدير Excel"
            aria-label="تصدير Excel"
          >
            <Download className="w-4 h-4 text-ok" />
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handlePrintReport}
            disabled={isTopPrinting}
            isLoading={isTopPrinting}
            className="min-w-[44px] px-2.5"
            title="طباعة التقرير"
            aria-label="طباعة التقرير"
          >
            {!isTopPrinting && <Printer className="w-4 h-4" />}
          </Button>
        </div>
      </Card>

      {/* Shared Navigation Tabs (Responsive Desktop & Mobile) */}
      <Tabs
        tabs={reportTabs}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as ActiveTab)}
      />

      {/* Date Filter Bar (Shown for Profit, Sales, CashFlow) */}
      {activeTab !== 'stock' && (
        <Card className="p-2.5 sm:p-4 w-full min-w-0 max-w-full overflow-hidden">
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
        </Card>
      )}

      {/* Tab Panels */}
      {activeTab === 'profit' && canViewProfitReport && <ProfitReportTab data={profitData} isLoading={isProfitLoading} />}
      {activeTab === 'sales' && <SalesReportTab data={salesData} isLoading={isSalesLoading} />}
      {activeTab === 'purchases' && canViewPurchaseReport && (
        <PurchaseReportTab data={purchaseData} isLoading={isPurchaseLoading} />
      )}
      {activeTab === 'cash-flow' && (
        <CashFlowTab
          data={cashFlowData}
          isLoading={isCashFlowLoading}
          selectedTreasury={selectedTreasury}
          onSelectTreasury={setSelectedTreasury}
          preset={preset}
          fromDate={fromDate}
          toDate={toDate}
          onUpdatePrintData={setCashFlowPrintData}
        />
      )}
      {activeTab === 'stock' && (
        <StockReportTab
          data={stockData}
          isLoading={isStockLoading}
          page={stockPage}
          onPageChange={setStockPage}
          search={stockSearch}
          onSearchChange={(s) => {
            setStockSearch(s);
            setStockPage(1);
          }}
          isFetching={isStockFetching}
        />
      )}
      </div>

      {/* ========================================================================= */}
      {/* Dedicated Official Corporate Printable Report (Rendered only during print) */}
      {/* ========================================================================= */}
      <div className="print-only printable-area font-sans bg-paper text-paper-ink leading-relaxed text-xs" dir="rtl">
        {/* Official Store Letterhead */}
        <div className="border-b-2 border-paper-ink pb-4 mb-5 flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-black text-paper-ink">{storeName}</h1>
            <p className="text-xs font-bold text-paper-muted">نظام إنجاز برو لإدارة نقاط البيع والمخازن</p>
            {storePhone && <p className="text-[11px] text-paper-muted font-mono">الهاتف: {storePhone}</p>}
            {storeAddress && <p className="text-[11px] text-paper-muted">{storeAddress}</p>}
          </div>

          <div className="text-left space-y-1">
            <div className="inline-block bg-paper-ink text-paper font-black px-3 py-1 rounded text-sm">
              {activeTab === 'profit' && 'تقرير الأرباح والخسائر الشامل'}
              {activeTab === 'sales' && 'كشف حركة المبيعات والمتحصلات'}
              {activeTab === 'purchases' && 'تقرير المشتريات والموردين'}
              {activeTab === 'cash-flow' && `كشف حركة ${cashFlowPrintData?.treasuryName || getTreasuryLabel(selectedTreasury)}`}
              {activeTab === 'stock' && 'تقرير جرد وتقييم المخزون'}
            </div>
            {activeTab !== 'stock' && (
              <p className="text-[11px] text-paper-muted font-mono">
                الفترة: {getPresetLabel(preset)} ({fromDate || 'البداية'} إلى {toDate || 'اليوم'})
              </p>
            )}
            <p className="text-2xs text-paper-muted font-mono">
              تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG')}
            </p>
            <p className="text-2xs text-paper-muted">
              المستخدم: {user?.name}
            </p>
          </div>
        </div>

        {/* Tab 1: Profit Report Table */}
        {activeTab === 'profit' && profitData && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-paper-ink border-b border-paper-line pb-1">
              قائمة الدخل والأرباح التشغيلية
            </h2>
            <table className="w-full text-right border-collapse border border-paper-line text-xs">
              <tbody>
                <tr className="border-b border-paper-line bg-paper-soft font-bold">
                  <td className="p-2 border border-paper-line">إجمالي المبيعات (Gross Sales)</td>
                  <td className="p-2 border border-paper-line font-mono text-left font-black">{formatCurrency(profitData.sales?.gross_sales || 0)}</td>
                </tr>
                <tr className="border-b border-paper-line">
                  <td className="p-2 border border-paper-line pr-6">├─ مبيعات أصناف المنتجات</td>
                  <td className="p-2 border border-paper-line font-mono text-left">{formatCurrency((profitData.sales as any)?.product_sales ?? profitData.sales?.gross_sales ?? 0)}</td>
                </tr>
                <tr className="border-b border-paper-line">
                  <td className="p-2 border border-paper-line pr-6">├─ إيرادات خدمات الشحن والتوصيل المحصلة</td>
                  <td className="p-2 border border-paper-line font-mono text-left font-bold text-brand">{formatCurrency((profitData.sales as any)?.shipping_revenue ?? 0)}</td>
                </tr>
                {Number((profitData.sales as any)?.discounts || 0) > 0 && (
                  <tr className="border-b border-paper-line text-bad">
                    <td className="p-2 border border-paper-line pr-6">├─ الخصومات الممنوحة على الفواتير (-)</td>
                    <td className="p-2 border border-paper-line font-mono text-left">-{formatCurrency((profitData.sales as any)?.discounts || 0)}</td>
                  </tr>
                )}
                <tr className="border-b border-paper-line text-bad">
                  <td className="p-2 border border-paper-line pr-6">└─ مرتجعات المبيعات (-)</td>
                  <td className="p-2 border border-paper-line font-mono text-left">-{formatCurrency(profitData.sales?.sale_returns || 0)}</td>
                </tr>
                <tr className="border-b border-paper-line bg-paper-soft font-black">
                  <td className="p-2 border border-paper-line">= صافي المبيعات (Net Sales)</td>
                  <td className="p-2 border border-paper-line font-mono text-left text-sm">{formatCurrency(profitData.sales?.net_sales || 0)}</td>
                </tr>
                <tr className="border-b border-paper-line text-bad">
                  <td className="p-2 border border-paper-line">تكلفة البضاعة المباعة (COGS) (-)</td>
                  <td className="p-2 border border-paper-line font-mono text-left font-bold">-{formatCurrency(profitData.cogs?.net_cogs || 0)}</td>
                </tr>
                <tr className="border-b border-paper-line bg-paper-soft font-black">
                  <td className="p-2 border border-paper-line">= إجمالي الربح التجاري (Gross Profit)</td>
                  <td className="p-2 border border-paper-line font-mono text-left text-sm text-ok">{formatCurrency(profitData.profit?.gross_profit || 0)}</td>
                </tr>
                <tr className="border-b border-paper-line text-bad">
                  <td className="p-2 border border-paper-line">إجمالي المصروفات التشغيلية واليومية (-)</td>
                  <td className="p-2 border border-paper-line font-mono text-left font-bold">-{formatCurrency(profitData.profit?.total_expenses || 0)}</td>
                </tr>
                <tr className="border-2 border-paper-ink bg-paper-soft font-black text-sm">
                  <td className="p-2.5 border border-paper-ink">= صافي الربح الفعلي النهائي (Net Profit)</td>
                  <td className="p-2.5 border border-paper-ink font-mono text-left text-base text-ok">{formatCurrency(profitData.profit?.net_profit || 0)}</td>
                </tr>
                <tr className="border-b border-paper-line font-bold bg-paper-soft">
                  <td className="p-2 border border-paper-line">نسبة هامش صافي الربح (%)</td>
                  <td className="p-2 border border-paper-line font-mono text-left font-bold">{profitData.profit?.profit_margin || 0}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Sales Report Table */}
        {activeTab === 'sales' && salesData && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-paper-ink border-b border-paper-line pb-1">
              ملخص إحصائيات المبيعات والمتحصلات
            </h2>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="border border-paper-line p-2 bg-paper-soft">
                <span className="text-2xs text-paper-muted block">إجمالي المبيعات:</span>
                <span className="font-mono font-black text-xs">{formatCurrency(salesData.total_sales || 0)}</span>
              </div>
              <div className="border border-paper-line p-2 bg-paper-soft">
                <span className="text-2xs text-paper-muted block">المبالغ المحصلة (مدفوعة):</span>
                <span className="font-mono font-black text-xs text-ok">{formatCurrency(salesData.sales_paid || 0)}</span>
              </div>
              <div className="border border-paper-line p-2 bg-paper-soft">
                <span className="text-2xs text-paper-muted block">المتبقي (آجل):</span>
                <span className="font-mono font-black text-xs text-bad">{formatCurrency(salesData.sales_remaining || 0)}</span>
              </div>
            </div>

            {/* Payment breakdown */}
            {salesData.payment_methods && salesData.payment_methods.length > 0 && (
              <div>
                <h3 className="text-xs font-black text-paper-ink mb-1">تفصيل طرق الدفع:</h3>
                <table className="w-full text-right border border-paper-line text-xs">
                  <thead className="bg-paper-soft font-bold">
                    <tr>
                      <th className="p-2 border border-paper-line">طريقة الدفع</th>
                      <th className="p-2 border border-paper-line text-center">عدد الفواتير</th>
                      <th className="p-2 border border-paper-line text-left">إجمالي المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.payment_methods.map((pm: any, idx: number) => (
                      <tr key={idx} className="border-b border-paper-line">
                        <td className="p-2 border border-paper-line font-bold">
                          {pm.payment_method === 'CASH' ? 'نقدي (كاش)' :
                           pm.payment_method === 'CARD' ? 'بطاقة / فيزا' :
                           pm.payment_method === 'INSTAPAY' ? 'إنستاباي (InstaPay)' :
                           pm.payment_method === 'VODAFONE_CASH' ? 'فودافون كاش ومحافظ' :
                           pm.payment_method === 'SPLIT' ? 'دفع مجزأ' :
                           pm.payment_method === 'TRANSFER' ? 'تحويل بنكي' : 'آجل على الحساب'}
                        </td>
                        <td className="p-2 border border-paper-line text-center font-mono">{pm.count}</td>
                        <td className="p-2 border border-paper-line text-left font-mono font-bold">{formatCurrency(pm.total_amount)}</td>
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
            <div className="border-b border-paper-line pb-1.5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-paper-ink">
                  كشف حركة الحصيلة والخزينة — {cashFlowPrintData?.treasuryName || getTreasuryLabel(selectedTreasury)}
                </h2>
                <div className="flex items-center gap-2 text-2xs text-paper-muted font-medium mt-0.5">
                  <span>الفترة: {getPresetLabel(preset)} ({fromDate || 'البداية'} إلى {toDate || 'اليوم'})</span>
                  {cashFlowPrintData?.flowFilter && cashFlowPrintData.flowFilter !== 'ALL' && (
                    <span className="font-bold text-paper-ink">
                      • التصفية: {cashFlowPrintData.flowFilter === 'INFLOW' ? 'الوارد فقط (+)' : 'الصادر فقط (-)'}
                    </span>
                  )}
                  {cashFlowPrintData?.movementCategory && (
                    <span className="font-bold text-paper-ink">
                      • تصنيف الحركة: {cashFlowPrintData.movementCategory}
                    </span>
                  )}
                  {cashFlowPrintData?.search && (
                    <span className="font-bold text-paper-ink">
                      • نتيجة البحث عن: "{cashFlowPrintData.search}"
                    </span>
                  )}
                </div>
              </div>
              {cashFlowPrintData?.transactions && (
                <span className="text-[11px] font-bold font-mono bg-paper-soft border border-paper-line px-2 py-0.5 rounded">
                  {cashFlowPrintData.transactions.length} حركة مسجلة
                </span>
              )}
            </div>

            {/* Summary statistics boxes */}
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="border border-paper-line p-2 bg-paper-soft">
                <span className="text-2xs text-paper-muted font-bold block">إجمالي المقبوضات (الوارد +):</span>
                <span className="font-mono font-black text-xs text-ok">
                  {formatCurrency(
                    cashFlowPrintData?.transactions && cashFlowPrintData.transactions.length > 0
                      ? cashFlowPrintData.transactions
                          .filter((t) => t.flow_direction === 'IN')
                          .reduce((sum, t) => sum + Number(t.amount || 0), 0)
                      : cashFlowData.inflow?.total || 0
                  )}
                </span>
              </div>
              <div className="border border-paper-line p-2 bg-paper-soft">
                <span className="text-2xs text-paper-muted font-bold block">إجمالي المدفوعات (الصادر -):</span>
                <span className="font-mono font-black text-xs text-bad">
                  {formatCurrency(
                    cashFlowPrintData?.transactions && cashFlowPrintData.transactions.length > 0
                      ? cashFlowPrintData.transactions
                          .filter((t) => t.flow_direction === 'OUT')
                          .reduce((sum, t) => sum + Number(t.amount || 0), 0)
                      : cashFlowData.outflow?.total || 0
                  )}
                </span>
              </div>
              <div className="border border-paper-line p-2 bg-paper-soft">
                <span className="text-2xs text-paper-ink font-bold block">صافي رصيد الحركة:</span>
                <span className="font-mono font-black text-xs text-paper-ink">
                  {formatCurrency(
                    cashFlowPrintData?.transactions && cashFlowPrintData.transactions.length > 0
                      ? cashFlowPrintData.transactions.reduce(
                          (sum, t) => sum + (t.flow_direction === 'IN' ? Number(t.amount || 0) : -Number(t.amount || 0)),
                          0
                        )
                      : cashFlowData.net_cash_flow || 0
                  )}
                </span>
              </div>
            </div>

            {/* Detailed Transactions Log Table */}
            {cashFlowPrintData?.transactions && cashFlowPrintData.transactions.length > 0 ? (
              <table className="w-full text-right border-collapse border border-paper-line text-2xs">
                <thead>
                  <tr className="bg-paper-soft font-bold border-b border-paper-line text-paper-ink">
                    <th className="p-1.5 border border-paper-line text-center w-7">م</th>
                    <th className="p-1.5 border border-paper-line whitespace-nowrap">التاريخ والوقت</th>
                    <th className="p-1.5 border border-paper-line whitespace-nowrap">المرجع / الرقم</th>
                    <th className="p-1.5 border border-paper-line whitespace-nowrap">نوع الحركة</th>
                    <th className="p-1.5 border border-paper-line">الطرف / العميل / المورد</th>
                    <th className="p-1.5 border border-paper-line whitespace-nowrap">المسؤول</th>
                    <th className="p-1.5 border border-paper-line">البيان / ملاحظات</th>
                    <th className="p-1.5 border border-paper-line text-left whitespace-nowrap">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlowPrintData.transactions.map((tx, idx) => {
                    const isInflow = tx.flow_direction === 'IN';
                    return (
                      <tr key={idx} className="border-b border-paper-line break-inside-avoid">
                        <td className="p-1.5 border border-paper-line text-center font-mono">{idx + 1}</td>
                        <td className="p-1.5 border border-paper-line whitespace-nowrap font-mono">{tx.date}</td>
                        <td className="p-1.5 border border-paper-line whitespace-nowrap font-mono font-bold">
                          {tx.reference_number || `#${tx.id}`}
                        </td>
                        <td className="p-1.5 border border-paper-line whitespace-nowrap font-bold">
                          {tx.category_label}
                        </td>
                        <td className="p-1.5 border border-paper-line">{tx.party_name || '—'}</td>
                        <td className="p-1.5 border border-paper-line whitespace-nowrap">{tx.creator_name || '—'}</td>
                        <td className="p-1.5 border border-paper-line text-paper-muted">{tx.notes || '—'}</td>
                        <td className="p-1.5 border border-paper-line text-left font-mono font-bold whitespace-nowrap">
                          <span className={isInflow ? 'text-ok' : 'text-bad'}>
                            {isInflow ? '+' : '-'} {formatCurrency(tx.amount)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-paper-soft font-bold border-t-2 border-paper-ink">
                    <td colSpan={7} className="p-2 border border-paper-line text-right font-black">
                      إجمالي صافي حركة العمليات أعلاه:
                    </td>
                    <td className="p-2 border border-paper-line text-left font-mono font-black text-xs whitespace-nowrap">
                      {formatCurrency(
                        cashFlowPrintData.transactions.reduce(
                          (sum, t) => sum + (t.flow_direction === 'IN' ? Number(t.amount || 0) : -Number(t.amount || 0)),
                          0
                        )
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="text-center py-4 text-paper-muted font-medium border border-dashed border-paper-line rounded">
                لا توجد حركات مسجلة تطابق هذه الخزينة والفترة المحددة.
              </p>
            )}
          </div>
        )}

        {/* Tab 4: Stock Report Table */}
        {activeTab === 'stock' && stockData && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-paper-ink border-b border-paper-line pb-1">
              تقرير تقييم وجرد المخزون
            </h2>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="border border-paper-line p-2 bg-paper-soft">
                <span className="text-2xs text-paper-muted block">إجمالي عدد القطع:</span>
                <span className="font-mono font-black text-xs">{stockData.summary?.total_quantity || 0}</span>
              </div>
              <div className="border border-paper-line p-2 bg-paper-soft">
                <span className="text-2xs text-paper-muted block">تقييم المخزون بسعر الشراء (التكلفة):</span>
                <span className="font-mono font-black text-xs text-paper-ink">{formatCurrency(stockData.summary?.total_cost_value || 0)}</span>
              </div>
              <div className="border border-paper-line p-2 bg-paper-soft">
                <span className="text-2xs text-paper-muted block">تقييم المخزون بسعر البيع (القطاعي):</span>
                <span className="font-mono font-black text-xs text-ok">{formatCurrency(stockData.summary?.total_retail_value || 0)}</span>
              </div>
            </div>

            {/* Products Table */}
            {stockData.products && stockData.products.length > 0 && (
              <table className="w-full text-right border border-paper-line text-[11px]">
                <thead className="bg-paper-soft font-bold">
                  <tr>
                    <th className="p-1.5 border border-paper-line">م</th>
                    <th className="p-1.5 border border-paper-line">الصنف</th>
                    <th className="p-1.5 border border-paper-line text-center">الرصيد</th>
                    <th className="p-1.5 border border-paper-line text-left">سعر البيع</th>
                    <th className="p-1.5 border border-paper-line text-left">قيمة البيع</th>
                  </tr>
                </thead>
                <tbody>
                  {stockData.products.map((p: any, idx: number) => (
                    <tr key={idx} className="border-b border-paper-line">
                      <td className="p-1.5 border border-paper-line font-mono">{idx + 1}</td>
                      <td className="p-1.5 border border-paper-line font-bold">{p.name} ({p.code || p.barcode || '-'})</td>
                      <td className="p-1.5 border border-paper-line text-center font-mono font-bold">{p.quantity}</td>
                      <td className="p-1.5 border border-paper-line text-left font-mono">{formatCurrency(p.sale_price)}</td>
                      <td className="p-1.5 border border-paper-line text-left font-mono font-bold">{formatCurrency(p.retail_value ?? (p.sale_price * p.quantity))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Formal Approval Signatures & Stamp */}
        <div className="pt-10 mt-8 border-t-2 border-paper-line grid grid-cols-3 text-center text-xs">
          <div className="space-y-8">
            <p className="font-bold text-paper-ink">توقيع المحاسب المالي</p>
            <p className="text-paper-muted font-mono">...................................</p>
          </div>
          <div className="space-y-8">
            <p className="font-bold text-paper-ink">اعتماد الإدارة العامة</p>
            <p className="text-paper-muted font-mono">...................................</p>
          </div>
          <div className="space-y-8">
            <p className="font-bold text-paper-ink">خاتم المنشأة</p>
            <div className="w-20 h-20 border border-dashed border-paper-line rounded-full mx-auto" />
          </div>
        </div>
      </div>
    </>
  );
};
