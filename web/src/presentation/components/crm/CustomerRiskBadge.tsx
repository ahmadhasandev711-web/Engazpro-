import React from 'react';
import { AlertTriangle, ShieldAlert, Crown, Repeat, UserCheck } from 'lucide-react';
import { CrmRiskLevel, CustomerTier, PartyCrmMetrics } from '@pos-mandob/shared';
import { Badge, BadgeTone } from '../ui';
import { cn } from '../../utils/cn';

interface CustomerRiskBadgeProps {
  metrics?: PartyCrmMetrics | null;
  variant?: 'badge' | 'banner' | 'compact';
  className?: string;
}

function resolveTierStyle(tier: CustomerTier): {
  tone: BadgeTone;
  label: string;
  icon: React.ReactNode;
} {
  switch (tier) {
    case CustomerTier.BLACKLISTED:
      return { tone: 'bad', label: 'محظور / رافض استلام', icon: <ShieldAlert className="w-3 h-3" /> };
    case CustomerTier.HIGH_CANCELLATION:
      return { tone: 'warn', label: 'عالي الإلغاء', icon: <AlertTriangle className="w-3 h-3" /> };
    case CustomerTier.VIP:
      return { tone: 'brand', label: 'VIP مميز', icon: <Crown className="w-3 h-3" /> };
    case CustomerTier.REPEAT:
      return { tone: 'ok', label: 'عميل متكرر', icon: <Repeat className="w-3 h-3" /> };
    case CustomerTier.REGULAR:
    default:
      return { tone: 'neutral', label: 'عميل عادي', icon: <UserCheck className="w-3 h-3" /> };
  }
}

export const CustomerRiskBadge: React.FC<CustomerRiskBadgeProps> = ({
  metrics,
  variant = 'badge',
  className,
}) => {
  if (!metrics) return null;

  const { tone, label, icon } = resolveTierStyle(metrics.effective_tier);

  if (variant === 'banner') {
    if (!metrics.show_warning || !metrics.warning_message) {
      return null;
    }

    const isHigh = metrics.risk_level === CrmRiskLevel.HIGH || metrics.effective_tier === CustomerTier.BLACKLISTED;
    return (
      <div
        className={cn(
          'p-2.5 rounded-2xl border text-2xs font-bold flex items-start gap-2 leading-relaxed',
          isHigh
            ? 'bg-bad-soft border-bad/30 text-bad'
            : 'bg-warn-soft border-warn/30 text-warn',
          className
        )}
        dir="rtl"
      >
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="space-y-0.5 min-w-0">
          <p className="font-black">{metrics.warning_message}</p>
          <p className="opacity-85 tabular-nums">
            ناجح: {metrics.delivered_orders_count} • ملغي/مرتجع: {metrics.cancelled_or_returned_count} ({metrics.cancellation_rate}%)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-1.5 flex-wrap', className)}>
      <Badge tone={tone} className="text-2xs font-black inline-flex items-center gap-1">
        {icon}
        <span>{label}</span>
      </Badge>
      {variant !== 'compact' && metrics.total_orders_count > 0 && (
        <span className="text-2xs text-muted tabular-nums font-medium">
          ({metrics.delivered_orders_count} ناجح / {metrics.cancelled_or_returned_count} ملغي)
        </span>
      )}
    </div>
  );
};
