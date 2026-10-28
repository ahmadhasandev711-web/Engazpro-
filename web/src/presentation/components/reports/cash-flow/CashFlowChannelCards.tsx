import React from 'react';
import { Wallet, TrendingUp, Receipt, Smartphone, Landmark } from 'lucide-react';
import { formatCurrency, CashFlowReportData } from '@pos-mandob/shared';

export type SelectedTreasuryType = 'CASH' | 'CARD' | 'INSTAPAY' | 'VODAFONE_CASH' | 'TRANSFER';

interface CashFlowChannelCardsProps {
  data?: CashFlowReportData;
  selectedTreasury: SelectedTreasuryType;
  onSelectTreasury: (t: SelectedTreasuryType) => void;
}

export const CashFlowChannelCards: React.FC<CashFlowChannelCardsProps> = ({
  data,
  selectedTreasury,
  onSelectTreasury,
}) => {
  const treasuries = data?.treasuries;

  return (
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

      {/* Bank Transfers */}
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
  );
};
