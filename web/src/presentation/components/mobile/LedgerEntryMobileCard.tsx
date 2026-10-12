import React from 'react';
import { Calendar, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@pos-mandob/shared';

interface LedgerEntryMobileCardProps {
  entry: {
    id: number;
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance_after: number;
  };
}

export const LedgerEntryMobileCard: React.FC<LedgerEntryMobileCardProps> = ({ entry }) => {
  const isDebit = Number(entry.debit) > 0;
  const isCredit = Number(entry.credit) > 0;

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs space-y-2 border-r-4 ${
        isDebit
          ? 'border-r-rose-500'
          : isCredit
          ? 'border-r-emerald-500'
          : 'border-r-slate-300'
      }`}
    >
      {/* Top Row: Date & Running Balance */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium flex items-center gap-1 font-sans">
          <Calendar className="w-3.5 h-3.5" />
          {formatDate(entry.date)}
        </span>
        <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60">
          الرصيد: {formatCurrency(entry.balance_after)}
        </span>
      </div>

      {/* Description */}
      <p className="font-bold text-sm text-slate-900 leading-snug">{entry.description}</p>

      {/* Debit / Credit Badges */}
      <div className="flex items-center gap-2 pt-1 font-mono text-xs">
        {isDebit && (
          <span className="inline-flex items-center gap-1 text-rose-700 font-black bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl">
            <ArrowUpRight className="w-3 h-3 text-rose-600" />
            مدين (+): {formatCurrency(entry.debit)}
          </span>
        )}
        {isCredit && (
          <span className="inline-flex items-center gap-1 text-emerald-700 font-black bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
            <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
            دائن (-): {formatCurrency(entry.credit)}
          </span>
        )}
      </div>
    </div>
  );
};
