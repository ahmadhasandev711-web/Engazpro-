import React from 'react';
import { Wallet, TrendingUp, Receipt, ArrowDownLeft, ArrowUpRight, Smartphone, Landmark, Info } from 'lucide-react';
import { formatCurrency, CashFlowReportData } from '@pos-mandob/shared';

export type SelectedTreasuryType = 'CASH' | 'CARD' | 'INSTAPAY' | 'VODAFONE_CASH' | 'TRANSFER';

interface CashFlowTabProps {
  data?: CashFlowReportData;
  isLoading: boolean;
  selectedTreasury: SelectedTreasuryType;
  onSelectTreasury: (t: SelectedTreasuryType) => void;
  preset: string;
}

export const CashFlowTab: React.FC<CashFlowTabProps> = ({
  data,
  isLoading,
  selectedTreasury,
  onSelectTreasury,
  preset,
}) => {
  if (isLoading) {
    return <div className="text-center py-16 text-sm text-slate-400 font-medium">جاري احتساب حركة الخزن والنقدية...</div>;
  }

  const treasuries = data?.treasuries;
  const currentTreasury =
    selectedTreasury === 'CASH'
      ? treasuries?.cash
      : selectedTreasury === 'CARD'
      ? treasuries?.card
      : selectedTreasury === 'INSTAPAY'
      ? treasuries?.instapay
      : selectedTreasury === 'VODAFONE_CASH'
      ? treasuries?.vodafone_cash
      : treasuries?.transfer;

  const treasuryName =
    selectedTreasury === 'CASH'
      ? 'متحصلات المبيعات النقدية (الكاش)'
      : selectedTreasury === 'CARD'
      ? 'متحصلات البطاقة (فيزا / شبكة)'
      : selectedTreasury === 'INSTAPAY'
      ? 'متحصلات إنستاباي (InstaPay)'
      : selectedTreasury === 'VODAFONE_CASH'
      ? 'متحصلات فودافون كاش والمحافظ'
      : 'متحصلات التحويلات البنكية المباشرة';

  const inflow =
    currentTreasury?.inflow ||
    (selectedTreasury === 'CASH'
      ? data?.inflow
      : { sales: 0, receipt_vouchers: 0, purchase_returns: 0, total: 0 });

  const outflow =
    currentTreasury?.outflow ||
    (selectedTreasury === 'CASH'
      ? data?.outflow
      : { purchases: 0, payment_vouchers: 0, sale_returns: 0, expenses: 0, total: 0 });

  const netBalance =
    currentTreasury?.net_balance ??
    (selectedTreasury === 'CASH' ? data?.net_cash_flow || 0 : 0);

  const totalFunds = data?.total_funds ?? data?.net_cash_flow ?? 0;

  return (
    <div className="space-y-6">
      {/* Informative Guidance Banner */}
      <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-xs text-amber-900 shadow-xs">
        <div className="p-1.5 bg-amber-100 text-amber-700 rounded-xl mt-0.5">
          <Info className="w-4 h-4" />
        </div>
        <div className="space-y-0.5">
          <p className="font-bold text-amber-950">
            طبيعة هذا التقرير: تقرير التدفقات والمتحصلات المحصلة خلال الفترة المحددة
          </p>
          <p className="text-amber-800 leading-relaxed text-[11px]">
            يوضح هذا التقرير صافي الإيرادات والمبيعات المقبوضة مطروحاً منها المصروفات بحسب قناة الدفع (كاش، فيزا، إنستاباي، فودافون كاش، تحويل).
            أما <strong>الأرصدة اللحظية الفعلية للخزائن النقدية والحسابات البنكية والمحافظ</strong>، فتتابعها وتديرها بدقة لحظة بلحظة من شاشة <span className="font-bold text-amber-950 underline">إدارة الخزن والحسابات</span>.
          </p>
        </div>
      </div>

      {/* Total Funds Overview Banner */}
      <div className="p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-br from-teal-700 to-teal-900 text-white border-teal-600">
        <div>
          <div className="flex items-center gap-2 text-white/90 text-sm font-medium mb-1">
            <Wallet className="w-5 h-5" />
            <span>صافي المتحصلات والتدفقات ({preset === 'today' ? 'اليوم' : 'الفترة المحددة'})</span>
          </div>
          <h3 className="text-4xl font-black tracking-tight font-mono">
            {formatCurrency(totalFunds)}
          </h3>
          <p className="text-xs text-teal-100 mt-1">
            صافي ما تم تحصيله من العملاء مطروحاً منه المصروفات خلال هذه الفترة بكل الوسائل
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20">
          <div className="text-center px-1.5">
            <span className="text-[10px] text-teal-100 font-bold block">💵 الكاش</span>
            <span className="text-xs font-black font-mono">
              {formatCurrency(treasuries?.cash?.net_balance ?? data?.net_cash_flow ?? 0)}
            </span>
          </div>
          <div className="h-5 w-px bg-white/20" />
          <div className="text-center px-1.5">
            <span className="text-[10px] text-teal-100 font-bold block">💳 البطاقة</span>
            <span className="text-xs font-black font-mono">
              {formatCurrency(treasuries?.card?.net_balance ?? 0)}
            </span>
          </div>
          <div className="h-5 w-px bg-white/20" />
          <div className="text-center px-1.5">
            <span className="text-[10px] text-teal-100 font-bold block">⚡ إنستاباي</span>
            <span className="text-xs font-black font-mono">
              {formatCurrency(treasuries?.instapay?.net_balance ?? 0)}
            </span>
          </div>
          <div className="h-5 w-px bg-white/20" />
          <div className="text-center px-1.5">
            <span className="text-[10px] text-teal-100 font-bold block">📱 فودافون</span>
            <span className="text-xs font-black font-mono">
              {formatCurrency(treasuries?.vodafone_cash?.net_balance ?? 0)}
            </span>
          </div>
        </div>
      </div>

      {/* 5 Channels Interactive Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Cash */}
        <button
          type="button"
          onClick={() => onSelectTreasury('CASH')}
          className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
            selectedTreasury === 'CASH'
              ? 'bg-amber-50/80 border-amber-500 shadow-md ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-amber-600" />
              متحصلات الكاش
            </span>
            {selectedTreasury === 'CASH' && (
              <span className="text-[9px] font-bold bg-amber-600 text-white px-1.5 py-0.5 rounded-full">نشطة</span>
            )}
          </div>
          <p className="text-lg font-black text-slate-900 font-mono">
            {formatCurrency(treasuries?.cash?.net_balance ?? data?.net_cash_flow ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">صافي المقبوض نقداً في الفترة</p>
        </button>

        {/* Card */}
        <button
          type="button"
          onClick={() => onSelectTreasury('CARD')}
          className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
            selectedTreasury === 'CARD'
              ? 'bg-purple-50/80 border-purple-500 shadow-md ring-2 ring-purple-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-xs font-bold text-purple-800 flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5 text-purple-600" />
              متحصلات البطاقة (POS)
            </span>
            {selectedTreasury === 'CARD' && (
              <span className="text-[9px] font-bold bg-purple-600 text-white px-1.5 py-0.5 rounded-full">نشطة</span>
            )}
          </div>
          <p className="text-lg font-black text-slate-900 font-mono">
            {formatCurrency(treasuries?.card?.net_balance ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">مدفوعات نقاط البيع والفيزا</p>
        </button>

        {/* InstaPay */}
        <button
          type="button"
          onClick={() => onSelectTreasury('INSTAPAY')}
          className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
            selectedTreasury === 'INSTAPAY'
              ? 'bg-indigo-50/80 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-xs font-bold text-indigo-800 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
              متحصلات إنستاباي
            </span>
            {selectedTreasury === 'INSTAPAY' && (
              <span className="text-[9px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">نشطة</span>
            )}
          </div>
          <p className="text-lg font-black text-slate-900 font-mono">
            {formatCurrency(treasuries?.instapay?.net_balance ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">تحويلات InstaPay الفورية</p>
        </button>

        {/* Vodafone Cash */}
        <button
          type="button"
          onClick={() => onSelectTreasury('VODAFONE_CASH')}
          className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
            selectedTreasury === 'VODAFONE_CASH'
              ? 'bg-rose-50/80 border-rose-500 shadow-md ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-xs font-bold text-rose-800 flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-rose-600" />
              فودافون والمحافظ
            </span>
            {selectedTreasury === 'VODAFONE_CASH' && (
              <span className="text-[9px] font-bold bg-rose-600 text-white px-1.5 py-0.5 rounded-full">نشطة</span>
            )}
          </div>
          <p className="text-lg font-black text-slate-900 font-mono">
            {formatCurrency(treasuries?.vodafone_cash?.net_balance ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">محافظ الموبايل الذكية</p>
        </button>

        {/* Other Transfers */}
        <button
          type="button"
          onClick={() => onSelectTreasury('TRANSFER')}
          className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
            selectedTreasury === 'TRANSFER'
              ? 'bg-sky-50/80 border-sky-500 shadow-md ring-2 ring-sky-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-xs font-bold text-sky-800 flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5 text-sky-600" />
              التحويلات البنكية
            </span>
            {selectedTreasury === 'TRANSFER' && (
              <span className="text-[9px] font-bold bg-sky-600 text-white px-1.5 py-0.5 rounded-full">نشطة</span>
            )}
          </div>
          <p className="text-lg font-black text-slate-900 font-mono">
            {formatCurrency(treasuries?.transfer?.net_balance ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">حسابات بنكية وتحويلات مباشرة</p>
        </button>
      </div>

      {/* Detailed Inflow vs Outflow Cards for Active Treasury */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inflow */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
              <h4 className="font-bold text-sm text-slate-900">الوارد إلى {treasuryName} (+)</h4>
            </div>
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              {formatCurrency(inflow?.total || (inflow as any)?.total_inflow || 0)}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
              <div>
                <p className="font-bold text-slate-800">مبيعات محصلة</p>
                <p className="text-[11px] text-slate-400">إجمالي المبيعات المسددة عبر {treasuryName}</p>
              </div>
              <span className="font-black text-slate-900 font-mono text-sm">
                {formatCurrency(inflow?.sales ?? (inflow as any)?.cash_sales ?? 0)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
              <div>
                <p className="font-bold text-slate-800">سندات قبض</p>
                <p className="text-[11px] text-slate-400">مقبوضات سندات القبض من العملاء</p>
              </div>
              <span className="font-black text-slate-900 font-mono text-sm">
                {formatCurrency(inflow?.receipt_vouchers ?? 0)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
              <div>
                <p className="font-bold text-slate-800">مرتجعات شراء مستردة</p>
                <p className="text-[11px] text-slate-400">المبالغ المستردة من الموردين</p>
              </div>
              <span className="font-black text-slate-900 font-mono text-sm">
                {formatCurrency(inflow?.purchase_returns ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Outflow */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-rose-600" />
              <h4 className="font-bold text-sm text-slate-900">الصادر من {treasuryName} (-)</h4>
            </div>
            <span className="text-xs font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
              {formatCurrency(outflow?.total || (outflow as any)?.total_outflow || 0)}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
              <div>
                <p className="font-bold text-slate-800">مشتريات مدفوعة</p>
                <p className="text-[11px] text-slate-400">المدفوع للموردين لشراء بضاعة</p>
              </div>
              <span className="font-black text-slate-900 font-mono text-sm">
                {formatCurrency(outflow?.purchases ?? (outflow as any)?.cash_purchases ?? 0)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
              <div>
                <p className="font-bold text-slate-800">سندات صرف</p>
                <p className="text-[11px] text-slate-400">مدفوعات سندات الصرف للموردين</p>
              </div>
              <span className="font-black text-slate-900 font-mono text-sm">
                {formatCurrency(outflow?.payment_vouchers ?? 0)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
              <div>
                <p className="font-bold text-slate-800">مرتجعات بيع مردودة</p>
                <p className="text-[11px] text-slate-400">المبالغ المردودة للعملاء عند الإرجاع</p>
              </div>
              <span className="font-black text-slate-900 font-mono text-sm">
                {formatCurrency(outflow?.sale_returns ?? 0)}
              </span>
            </div>

            {selectedTreasury === 'CASH' && (
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-bold text-slate-800">المصروفات النقدية</p>
                  <p className="text-[11px] text-slate-400">المصروفات المنصرفة نقدًا</p>
                </div>
                <span className="font-black text-slate-900 font-mono text-sm">
                  {formatCurrency(outflow?.expenses ?? 0)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Net Balance Footer Card for Active Treasury */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary-600" />
          <span className="font-bold text-sm text-slate-800">صافي رصيد {treasuryName}:</span>
        </div>
        <span className="text-xl font-black font-mono text-primary-700">
          {formatCurrency(netBalance)}
        </span>
      </div>
    </div>
  );
};
