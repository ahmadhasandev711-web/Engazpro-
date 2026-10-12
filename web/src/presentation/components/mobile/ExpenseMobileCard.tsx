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
import { MobileCard } from './MobileCard';
import { useHaptic } from '../../hooks/useHaptic';

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

  const getPaymentMethodBadge = (method: string) => {
    switch (method) {
      case 'VODAFONE_CASH':
        return {
          label: 'فودافون كاش',
          className: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: Smartphone,
        };
      case 'INSTAPAY':
        return {
          label: 'إنستاباي',
          className: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: Smartphone,
        };
      case 'TRANSFER':
        return {
          label: 'تحويل بنكي',
          className: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: Landmark,
        };
      case 'CARD':
        return {
          label: 'بطاقة بنكية',
          className: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: CreditCard,
        };
      case 'CASH':
      default:
        return {
          label: 'نقدية الدرج',
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: Coins,
        };
    }
  };

  const badge = getPaymentMethodBadge(expense.payment_method);
  const MethodIcon = badge.icon;

  return (
    <MobileCard statusColor="rose" className="space-y-3">
      {/* 1. Header: Expense Title & Amount */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <h4 className="font-black text-slate-900 text-sm leading-tight break-words">
            {expense.title}
          </h4>
          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            {expense.date}
          </span>
        </div>

        <div className="text-left shrink-0">
          <span className="font-black text-rose-600 text-base font-mono block leading-none">
            {formatCurrency(expense.amount)}
          </span>
        </div>
      </div>

      {/* 2. Category & Payment Method Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-lg text-xs font-bold inline-flex items-center gap-1">
          <Tag className="w-3 h-3 text-slate-400" />
          {expense.category || 'عام'}
        </span>

        <span
          className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1 ${badge.className}`}
        >
          <MethodIcon className="w-3 h-3" />
          {badge.label}
        </span>
      </div>

      {/* 3. Notes (if present) */}
      {expense.notes && (
        <p className="text-[11px] text-slate-500 bg-slate-50/80 border border-slate-100 p-2 rounded-xl">
          {expense.notes}
        </p>
      )}

      {/* 4. Action Buttons Toolbar (Touch Targets >= 44px) */}
      <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100">
        <button
          type="button"
          onClick={() => {
            selection();
            onEditExpense(expense);
          }}
          className="min-h-[42px] px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl flex items-center gap-1.5 border border-slate-200 transition-all active:scale-95 cursor-pointer"
          title="تعديل المصروف"
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span>تعديل</span>
        </button>

        {canDeleteExpense && (
          <button
            type="button"
            onClick={() => {
              selection();
              onDeleteExpense(expense.id, expense.title);
            }}
            className="min-h-[42px] px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-xl flex items-center gap-1.5 border border-rose-200 transition-all active:scale-95 cursor-pointer"
            title="حذف المصروف"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف</span>
          </button>
        )}
      </div>
    </MobileCard>
  );
};
