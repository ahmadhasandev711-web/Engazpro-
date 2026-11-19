import React from 'react';
import { formatCurrency } from '@pos-mandob/shared';

export interface ShiftFinancialSummary {
  opening_balance: number;
  cash_sales: number;
  cash_receipts: number;
  cash_payments?: number;
  cash_returns?: number;
  expenses: number;
}

interface ShiftFinancialGridProps {
  shift: ShiftFinancialSummary;
  variant?: 'modal' | 'card';
}

/**
 * شبكة موحدة لعرض تفاصيل الحركات النقدية للوردية (تقفيل الوردية وتوريد العهدة)
 */
export const ShiftFinancialGrid: React.FC<ShiftFinancialGridProps> = ({
  shift,
  variant = 'modal',
}) => {
  const cashPayments = Number(shift.cash_payments ?? 0);
  const cashReturns = Number(shift.cash_returns ?? 0);

  const itemClass =
    variant === 'modal'
      ? 'bg-panel p-2.5 rounded-xl border border-line flex justify-between items-center'
      : 'p-2.5 bg-surface-2 rounded-xl border border-line/60';

  const labelClass = variant === 'modal' ? 'text-muted' : 'text-muted text-[11px] block';

  return (
    <div className={variant === 'modal' ? 'grid grid-cols-2 gap-2.5 text-xs' : 'grid grid-cols-2 gap-2 my-4 text-xs'}>
      <div className={itemClass}>
        <span className={labelClass}>رصيد الافتتاح:</span>
        <span className="font-bold text-ink tabular-nums">{formatCurrency(shift.opening_balance)}</span>
      </div>
      <div className={itemClass}>
        <span className={labelClass}>مبيعات كاش:</span>
        <span className="font-bold text-ok tabular-nums">+{formatCurrency(shift.cash_sales)}</span>
      </div>
      <div className={itemClass}>
        <span className={labelClass}>تحصيلات عملاء:</span>
        <span className="font-bold text-ok tabular-nums">+{formatCurrency(shift.cash_receipts)}</span>
      </div>
      <div className={itemClass}>
        <span className={labelClass}>سندات صرف نقدية:</span>
        <span className="font-bold text-bad tabular-nums">-{formatCurrency(cashPayments)}</span>
      </div>
      {cashReturns > 0 && (
        <div className={itemClass}>
          <span className={labelClass}>مرتجعات كاش:</span>
          <span className="font-bold text-bad tabular-nums">-{formatCurrency(cashReturns)}</span>
        </div>
      )}
      <div className={itemClass}>
        <span className={labelClass}>{variant === 'modal' ? 'مصروفات ونثريات:' : 'مصروفات:'}</span>
        <span className="font-bold text-bad tabular-nums">-{formatCurrency(shift.expenses)}</span>
      </div>
    </div>
  );
};
