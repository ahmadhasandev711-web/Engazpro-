import React from 'react';
import { cn } from '../../utils/cn';

export type StatCardTone = 'neutral' | 'brand' | 'ok' | 'warn' | 'bad' | 'info';

export interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: StatCardTone;
  highlight?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const DOT_TONE_CLASSES: Record<StatCardTone, string> = {
  neutral: 'bg-muted/40',
  brand: 'bg-brand',
  ok: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
};

const HIGHLIGHT_CLASSES: Record<StatCardTone, string> = {
  neutral: 'bg-panel border border-line-2 shadow-sm',
  brand: 'bg-panel border border-brand/40 shadow-sm',
  ok: 'bg-panel border border-brand/40 shadow-sm',
  warn: 'bg-panel border border-brand/40 shadow-sm',
  bad: 'bg-panel border border-bad/40 shadow-sm',
  info: 'bg-panel border border-brand/40 shadow-sm',
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  highlight = false,
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        'rounded-2xl sm:rounded-xl p-3.5 sm:p-5 shadow-xs transition-colors relative overflow-hidden',
        highlight ? HIGHLIGHT_CLASSES[tone] : 'bg-panel border border-line',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold truncate',
            highlight ? 'text-ink' : 'text-muted'
          )}
        >
          {tone !== 'neutral' && (
            <span
              className={cn('w-2 h-2 rounded-full shrink-0', DOT_TONE_CLASSES[tone])}
              aria-hidden="true"
            />
          )}
          <span className="truncate">{label}</span>
        </span>
        {icon && (
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 bg-surface-2 text-muted border border-line/60">
            {icon}
          </div>
        )}
      </div>

      <div className="text-lg sm:text-2xl font-black tracking-tight tabular-nums text-ink">
        {value}
      </div>

      {hint && <div className="text-[11px] text-muted mt-1 truncate">{hint}</div>}

      {children}
    </div>
  );
};
