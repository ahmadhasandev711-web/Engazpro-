import React from 'react';
import { formatCurrency } from '@pos-mandob/shared';
import { Card } from '../ui';
import { cn } from '../../utils/cn';

export interface StatementLineRow {
  label: string;
  amount: number;
  hint?: string | null;
  tone?: 'default' | 'ok' | 'bad' | 'brand' | 'warn';
  isTotal?: boolean;
}

interface StatementSectionCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  rows: StatementLineRow[];
  className?: string;
}

function toneClass(tone?: StatementLineRow['tone']): string {
  switch (tone) {
    case 'ok':
      return 'text-ok';
    case 'bad':
      return 'text-bad';
    case 'brand':
      return 'text-brand';
    case 'warn':
      return 'text-warn';
    default:
      return 'text-ink';
  }
}

export const StatementSectionCard: React.FC<StatementSectionCardProps> = ({
  title,
  subtitle,
  icon,
  rows,
  className,
}) => {
  return (
    <Card className={cn('p-0 overflow-hidden', className)}>
      <div className="px-5 py-4 border-b border-line bg-surface-2/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h3 className="text-sm font-black text-ink">{title}</h3>
            {subtitle && <p className="text-2xs text-muted">{subtitle}</p>}
          </div>
        </div>
      </div>

      <div className="divide-y divide-line">
        {rows.map((row, idx) => (
          <div
            key={idx}
            className={cn(
              'px-5 py-3 flex items-center justify-between gap-4',
              row.isTotal && 'bg-surface-2/60 font-black'
            )}
          >
            <div className="min-w-0">
              <p className={cn('text-xs sm:text-sm text-ink', row.isTotal ? 'font-black' : 'font-bold')}>
                {row.label}
              </p>
              {row.hint && <p className="text-2xs text-muted mt-0.5">{row.hint}</p>}
            </div>
            <span
              className={cn(
                'text-xs sm:text-sm tabular-nums shrink-0',
                row.isTotal ? 'font-black text-base' : 'font-bold',
                toneClass(row.tone)
              )}
              dir="ltr"
            >
              {formatCurrency(row.amount)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};
