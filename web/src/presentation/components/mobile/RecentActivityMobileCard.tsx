import React from 'react';
import { Clock, User, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';

interface RecentActivityMobileCardProps {
  activity: {
    id: number;
    category: string;
    type: string;
    type_label: string;
    reference: string;
    party_name: string;
    amount: number;
    date: string;
    created_at: string;
    created_by_name?: string | null;
    created_by_role?: string | null;
  };
}

export const RecentActivityMobileCard: React.FC<RecentActivityMobileCardProps> = ({ activity }) => {
  let badgeStyle = 'bg-slate-100 text-slate-800 border-slate-200';
  let isOutflow = false;

  if (activity.type === 'SALE') {
    badgeStyle = 'bg-blue-100 text-blue-800 border-blue-200';
  } else if (activity.type === 'PURCHASE') {
    badgeStyle = 'bg-purple-100 text-purple-800 border-purple-200';
    isOutflow = true;
  } else if (activity.type === 'SALE_RETURN') {
    badgeStyle = 'bg-amber-100 text-amber-800 border-amber-200';
    isOutflow = true;
  } else if (activity.type === 'PURCHASE_RETURN') {
    badgeStyle = 'bg-amber-100 text-amber-800 border-amber-200';
  } else if (activity.type === 'RECEIPT') {
    badgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-200';
  } else if (activity.type === 'PAYMENT' || activity.type === 'EXPENSE') {
    badgeStyle = 'bg-rose-100 text-rose-800 border-rose-200';
    isOutflow = true;
  }

  const roleLabel =
    activity.created_by_role === 'MANDOB'
      ? 'مندوب مبيعات'
      : activity.created_by_role === 'CASHIER'
      ? 'كاشير'
      : activity.created_by_role === 'MANAGER'
      ? 'مدير'
      : activity.created_by_role === 'SUPERVISOR'
      ? 'مشرف'
      : 'المالك';

  return (
    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
      {/* Top Row: Type Badge + Amount */}
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyle}`}>
          {isOutflow ? <ArrowUpRight className="w-3 h-3 text-rose-600" /> : <ArrowDownLeft className="w-3 h-3 text-emerald-600" />}
          {activity.type_label}
        </span>

        <span
          className={`font-black font-mono text-sm ${
            isOutflow ? 'text-rose-600' : 'text-emerald-700'
          }`}
        >
          {isOutflow ? '-' : '+'} {formatCurrency(activity.amount)}
        </span>
      </div>

      {/* Middle Row: Reference & Party */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-mono font-bold text-slate-900 truncate">
          #{activity.reference}
        </span>
        <span className="text-slate-600 font-medium truncate max-w-[180px]">
          {activity.party_name || '-'}
        </span>
      </div>

      {/* Footer: User & Time */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
        <div className="flex items-center gap-1 truncate">
          <User className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="text-slate-700 font-bold truncate">
            {activity.created_by_name || 'المالك'}
          </span>
          <span className="text-slate-400 text-[10px]">({roleLabel})</span>
        </div>

        <div className="flex items-center gap-1 font-mono shrink-0">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{activity.created_at || activity.date}</span>
        </div>
      </div>
    </div>
  );
};
