import React from 'react';
import { Wallet } from 'lucide-react';
import { formatCurrency, CashFlowReportData } from '@pos-mandob/shared';

interface CashFlowTotalBannerProps {
  data?: CashFlowReportData;
  preset: string;
}

export const CashFlowTotalBanner: React.FC<CashFlowTotalBannerProps> = ({ data, preset }) => {
  const treasuries = data?.treasuries;
  const totalFunds = data?.total_funds ?? data?.net_cash_flow ?? 0;

  return (
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
  );
};
