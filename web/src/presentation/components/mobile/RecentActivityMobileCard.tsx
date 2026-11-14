import React from 'react';
import { Clock, User, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { Badge, Card } from '../ui';
import type { BadgeProps } from '../ui';

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

interface ActivityMeta {
  tone: NonNullable<BadgeProps['tone']>;
  isOutflow: boolean;
}

const ACTIVITY_META_MAP: Record<string, ActivityMeta> = {
  SALE: { tone: 'info', isOutflow: false },
  PURCHASE: { tone: 'brand', isOutflow: true },
  SALE_RETURN: { tone: 'warn', isOutflow: true },
  PURCHASE_RETURN: { tone: 'warn', isOutflow: false },
  RECEIPT: { tone: 'ok', isOutflow: false },
  PAYMENT: { tone: 'bad', isOutflow: true },
  EXPENSE: { tone: 'bad', isOutflow: true },
};

const ROLE_LABEL_MAP: Record<string, string> = {
  MANDOB: 'مندوب مبيعات',
  CASHIER: 'كاشير',
  MANAGER: 'مدير',
  SUPERVISOR: 'مشرف',
};

export const RecentActivityMobileCard: React.FC<RecentActivityMobileCardProps> = ({ activity }) => {
  const { tone, isOutflow } = ACTIVITY_META_MAP[activity.type] ?? {
    tone: 'neutral' as const,
    isOutflow: false,
  };
  const roleLabel = ROLE_LABEL_MAP[activity.created_by_role ?? ''] ?? 'المالك';

  return (
    <Card className="p-3.5 space-y-2 shadow-2xs">
      {/* Top Row: Type Badge + Amount */}
      <div className="flex items-center justify-between gap-2">
        <Badge tone={tone} className="gap-1 text-2xs font-bold">
          {isOutflow ? (
            <ArrowUpRight className="w-3 h-3 text-bad" />
          ) : (
            <ArrowDownLeft className="w-3 h-3 text-ok" />
          )}
          {activity.type_label}
        </Badge>

        <span
          className={`font-black text-sm ${
            isOutflow ? 'text-bad' : 'text-ok'
          }`}
        >
          {isOutflow ? '-' : '+'} {formatCurrency(activity.amount)}
        </span>
      </div>

      {/* Middle Row: Reference & Party */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-bold text-ink truncate">
          #{activity.reference}
        </span>
        <span className="text-muted font-medium truncate max-w-[180px]">
          {activity.party_name || '-'}
        </span>
      </div>

      {/* Footer: User & Time */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-line text-2xs text-muted">
        <div className="flex items-center gap-1 truncate">
          <User className="w-3 h-3 text-muted shrink-0" />
          <span className="text-ink font-bold truncate">
            {activity.created_by_name || 'المالك'}
          </span>
          <span className="text-muted text-2xs">({roleLabel})</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Clock className="w-3 h-3 text-muted" />
          <span>{activity.created_at || activity.date}</span>
        </div>
      </div>
    </Card>
  );
};
