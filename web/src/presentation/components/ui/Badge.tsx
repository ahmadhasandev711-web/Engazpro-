import React from 'react';
import { cn } from '../../utils/cn';

export type BadgeTone = 'brand' | 'ok' | 'warn' | 'bad' | 'info' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  dot = false,
  className,
  children,
  ...props
}) => {
  const toneStyles: Record<BadgeTone, string> = {
    brand: 'bg-brand-soft text-brand-ink border-brand/20',
    ok: 'bg-ok-soft text-ok border-ok/20',
    warn: 'bg-warn-soft text-warn border-warn/20',
    bad: 'bg-bad-soft text-bad border-bad/20',
    info: 'bg-info-soft text-info border-info/20',
    neutral: 'bg-surface-2 text-muted border-line',
  };

  const dotStyles: Record<BadgeTone, string> = {
    brand: 'bg-brand',
    ok: 'bg-ok',
    warn: 'bg-warn',
    bad: 'bg-bad',
    info: 'bg-info',
    neutral: 'bg-muted',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors',
        toneStyles[tone],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotStyles[tone])} />}
      {children}
    </span>
  );
};
