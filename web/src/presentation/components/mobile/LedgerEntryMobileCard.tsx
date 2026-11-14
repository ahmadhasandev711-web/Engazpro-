import React from 'react';
import { Calendar, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@pos-mandob/shared';
import { Badge, Card } from '../ui';

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
    <Card
      className={`p-3.5 space-y-2 border-r-4 ${
        isDebit
          ? 'border-r-bad'
          : isCredit
          ? 'border-r-ok'
          : 'border-r-line'
      }`}
    >
      {/* Top Row: Date & Running Balance */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-3 font-medium flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {formatDate(entry.date)}
        </span>
        <Badge tone="neutral" className="tabular-nums font-black text-ink">
          الرصيد: {formatCurrency(entry.balance_after)}
        </Badge>
      </div>

      {/* Description */}
      <p className="font-bold text-sm text-ink leading-snug">{entry.description}</p>

      {/* Debit / Credit Badges */}
      <div className="flex items-center gap-2 pt-1 tabular-nums text-xs flex-wrap">
        {isDebit && (
          <Badge tone="bad" className="gap-1 font-black tabular-nums">
            <ArrowUpRight className="w-3 h-3" />
            مدين (+): {formatCurrency(entry.debit)}
          </Badge>
        )}
        {isCredit && (
          <Badge tone="ok" className="gap-1 font-black tabular-nums">
            <ArrowDownLeft className="w-3 h-3" />
            دائن (-): {formatCurrency(entry.credit)}
          </Badge>
        )}
      </div>
    </Card>
  );
};
