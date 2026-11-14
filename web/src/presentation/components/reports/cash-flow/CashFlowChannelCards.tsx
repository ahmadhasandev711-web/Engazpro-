import React from 'react';
import { Wallet, TrendingUp, Receipt, Smartphone, Landmark } from 'lucide-react';
import { formatCurrency, CashFlowReportData } from '@pos-mandob/shared';
import { Badge, BadgeTone } from '../../ui';

export type SelectedTreasuryType = 'CASH' | 'CARD' | 'INSTAPAY' | 'VODAFONE_CASH' | 'TRANSFER';

interface CashFlowChannelCardsProps {
  data?: CashFlowReportData;
  selectedTreasury: SelectedTreasuryType;
  onSelectTreasury: (t: SelectedTreasuryType) => void;
}

interface ChannelItem {
  id: SelectedTreasuryType;
  label: string;
  description: string;
  amount: number;
  icon: React.ReactNode;
  tone: BadgeTone;
  activeClass: string;
  labelToneClass: string;
}

export const CashFlowChannelCards: React.FC<CashFlowChannelCardsProps> = ({
  data,
  selectedTreasury,
  onSelectTreasury,
}) => {
  const treasuries = data?.treasuries;

  const channels: ChannelItem[] = [
    {
      id: 'CASH',
      label: 'متحصلات الكاش',
      description: 'صافي المقبوض نقداً في الفترة',
      amount: treasuries?.cash?.net_balance ?? data?.net_cash_flow ?? 0,
      icon: <Wallet className="w-3.5 h-3.5 text-warn" />,
      tone: 'warn',
      activeClass: 'bg-warn-soft/80 border-warn shadow-sm ring-2 ring-warn/20',
      labelToneClass: 'text-warn',
    },
    {
      id: 'CARD',
      label: 'متحصلات البطاقة (POS)',
      description: 'مدفوعات نقاط البيع والفيزا',
      amount: treasuries?.card?.net_balance ?? 0,
      icon: <Receipt className="w-3.5 h-3.5 text-brand" />,
      tone: 'brand',
      activeClass: 'bg-brand-soft/80 border-brand shadow-sm ring-2 ring-brand/20',
      labelToneClass: 'text-brand-ink',
    },
    {
      id: 'INSTAPAY',
      label: 'متحصلات إنستاباي',
      description: 'تحويلات InstaPay الفورية',
      amount: treasuries?.instapay?.net_balance ?? 0,
      icon: <TrendingUp className="w-3.5 h-3.5 text-info" />,
      tone: 'info',
      activeClass: 'bg-info-soft/80 border-info shadow-sm ring-2 ring-info/20',
      labelToneClass: 'text-info',
    },
    {
      id: 'VODAFONE_CASH',
      label: 'فودافون والمحافظ',
      description: 'محافظ الموبايل الذكية',
      amount: treasuries?.vodafone_cash?.net_balance ?? 0,
      icon: <Smartphone className="w-3.5 h-3.5 text-bad" />,
      tone: 'bad',
      activeClass: 'bg-bad-soft/80 border-bad shadow-sm ring-2 ring-bad/20',
      labelToneClass: 'text-bad',
    },
    {
      id: 'TRANSFER',
      label: 'التحويلات البنكية',
      description: 'حسابات بنكية وتحويلات مباشرة',
      amount: treasuries?.transfer?.net_balance ?? 0,
      icon: <Landmark className="w-3.5 h-3.5 text-ok" />,
      tone: 'ok',
      activeClass: 'bg-ok-soft/80 border-ok shadow-sm ring-2 ring-ok/20',
      labelToneClass: 'text-ok',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {channels.map((ch) => {
        const isActive = selectedTreasury === ch.id;
        return (
          <button
            key={ch.id}
            type="button"
            onClick={() => onSelectTreasury(ch.id)}
            className={`min-h-[44px] p-4 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
              isActive ? ch.activeClass : 'bg-panel border-line hover:border-line-2'
            }`}
          >
            <div className="flex items-center justify-between gap-1 w-full mb-2">
              <span className={`text-xs font-bold flex items-center gap-1 ${ch.labelToneClass}`}>
                {ch.icon}
                {ch.label}
              </span>
              {isActive && (
                <Badge tone={ch.tone} className="text-[10px] px-1.5 py-0">
                  نشطة
                </Badge>
              )}
            </div>
            <p className="text-lg font-black text-ink tabular-nums">{formatCurrency(ch.amount)}</p>
            <p className="text-[11px] text-muted mt-1">{ch.description}</p>
          </button>
        );
      })}
    </div>
  );
};
