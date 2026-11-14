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

const VALUE_TONE_CLASSES: Record<StatCardTone, string> = {
  neutral: 'text-ink',
  brand: 'text-brand',
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
  info: 'text-info',
};

const ICON_TONE_CLASSES: Record<StatCardTone, string> = {
  neutral: 'bg-surface-2 text-muted',
  brand: 'bg-brand-soft text-brand',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  info: 'bg-info-soft text-info',
};

const HIGHLIGHT_CLASSES: Record<StatCardTone, string> = {
  neutral: 'border-2 border-line-2 bg-surface-2/50',
  brand: 'border-2 border-brand bg-brand-soft/40',
  ok: 'border-2 border-ok bg-ok-soft/40',
  warn: 'border-2 border-warn bg-warn-soft/40',
  bad: 'border-2 border-bad bg-bad-soft/40',
  info: 'border-2 border-info bg-info-soft/40',
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
            'text-[11px] sm:text-xs font-bold truncate',
            highlight ? VALUE_TONE_CLASSES[tone] : 'text-muted'
          )}
        >
          {label}
        </span>
        {icon && (
          <div
            className={cn(
              'w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0',
              ICON_TONE_CLASSES[tone]
            )}
          >
            {icon}
          </div>
        )}
      </div>

      <div
        className={cn(
          'text-lg sm:text-2xl font-black tracking-tight tabular-nums',
          VALUE_TONE_CLASSES[tone]
        )}
      >
        {value}
      </div>

      {hint && <div className="text-[11px] text-muted mt-1 truncate">{hint}</div>}

      {children}
    </div>
  );
};
