import React from 'react';
import {
  Calendar,
  Tag,
  Edit2,
  Trash2,
  CreditCard,
  Smartphone,
  Landmark,
  Coins,
} from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { useHaptic } from '../../hooks/useHaptic';
import { Badge, Button, Card } from '../ui';

interface ExpenseMobileCardProps {
  expense: any;
  canDeleteExpense: boolean;
  onEditExpense: (expense: any) => void;
  onDeleteExpense: (expenseId: number, title: string) => void;
}

/**
 * Presentation Layer - ExpenseMobileCard
 * Mobile-first card for daily business operating expenses.
 * Outflow alert styling, payment method badges, and >= 44px touch targets.
 */
export const ExpenseMobileCard: React.FC<ExpenseMobileCardProps> = ({
  expense,
  canDeleteExpense,
  onEditExpense,
  onDeleteExpense,
}) => {
  const { selection } = useHaptic();

  const getPaymentMethodBadge = (
    method: string
  ): { label: string; tone: 'bad' | 'brand' | 'info' | 'ok'; icon: typeof Coins } => {
    switch (method) {
      case 'VODAFONE_CASH':
        return {
          label: 'فودافون كاش',
          tone: 'bad',
          icon: Smartphone,
        };
      case 'INSTAPAY':
        return {
          label: 'إنستاباي',
          tone: 'brand',
          icon: Smartphone,
        };
      case 'TRANSFER':
        return {
          label: 'تحويل بنكي',
          tone: 'info',
          icon: Landmark,
        };
      case 'CARD':
        return {
          label: 'بطاقة بنكية',
          tone: 'info',
          icon: CreditCard,
        };
      case 'CASH':
      default:
        return {
          label: 'نقدية الدرج',
          tone: 'ok',
          icon: Coins,
        };
    }
  };

  const badge = getPaymentMethodBadge(expense.payment_method);
  const MethodIcon = badge.icon;

  return (
    <Card className="p-4 border-r-4 border-r-bad space-y-3">
      {/* 1. Header: Expense Title & Amount */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <h4 className="font-black text-ink text-sm leading-tight break-words">
            {expense.title}
          </h4>
          <span className="text-[11px] text-ink-3 tabular-nums flex items-center gap-1 mt-1">
            <Calendar className="w-3 h-3 text-ink-3" />
            {expense.date}
          </span>
        </div>

        <div className="text-left shrink-0">
          <span className="font-black text-bad text-base tabular-nums block leading-none">
            {formatCurrency(expense.amount)}
          </span>
        </div>
      </div>

      {/* 2. Category & Payment Method Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge tone="neutral" className="gap-1">
          <Tag className="w-3 h-3 text-ink-3" />
          {expense.category || 'عام'}
        </Badge>

        <Badge tone={badge.tone} className="gap-1">
          <MethodIcon className="w-3 h-3" />
          {badge.label}
        </Badge>
      </div>

      {/* 3. Notes (if present) */}
      {expense.notes && (
        <p className="text-[11px] text-ink-2 bg-bg-subtle border border-line-soft p-2 rounded-xl">
          {expense.notes}
        </p>
      )}

      {/* 4. Action Buttons Toolbar (Touch Targets >= 44px) */}
      <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-line-soft">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => {
            selection();
            onEditExpense(expense);
          }}
          className="px-3.5 text-xs font-bold gap-1.5"
          title="تعديل المصروف"
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span>تعديل</span>
        </Button>

        {canDeleteExpense && (
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => {
              selection();
              onDeleteExpense(expense.id, expense.title);
            }}
            className="px-3 text-xs font-bold text-bad bg-bad-soft hover:bg-bad/15 border border-bad/25 gap-1.5"
            title="حذف المصروف"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف</span>
          </Button>
        )}
      </div>
    </Card>
  );
};
