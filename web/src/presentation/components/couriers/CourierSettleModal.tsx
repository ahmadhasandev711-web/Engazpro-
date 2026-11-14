import React from 'react';
import { Wallet, X, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { Badge, Button, Input, Select } from '../ui';

export type SettleMethod = 'CASH' | 'CARD' | 'INSTAPAY' | 'VODAFONE_CASH' | 'TRANSFER';

export interface CourierSettleModalProps {
  courier: { name: string; balance: number | string; pending_cod_amount?: number };
  settleType: 'RECEIPT' | 'PAYMENT';
  onSettleTypeChange: (type: 'RECEIPT' | 'PAYMENT') => void;
  settleAmount: number;
  onSettleAmountChange: (amount: number) => void;
  settleMethod: SettleMethod;
  onSettleMethodChange: (method: SettleMethod) => void;
  settleNotes: string;
  onSettleNotesChange: (notes: string) => void;
  settleError: string | null;
  isPending: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

const METHOD_OPTIONS = [
  { value: 'CASH', label: 'نقدي (كاش بالخزينة)' },
  { value: 'INSTAPAY', label: 'تحويل إنستاباي (InstaPay)' },
  { value: 'VODAFONE_CASH', label: 'محفظة فودافون كاش ومحافظ' },
  { value: 'TRANSFER', label: 'تحويل بنكي' },
  { value: 'CARD', label: 'بطاقة بنكية / فيزا' },
];

export const CourierSettleModal: React.FC<CourierSettleModalProps> = ({
  courier,
  settleType,
  onSettleTypeChange,
  settleAmount,
  onSettleAmountChange,
  settleMethod,
  onSettleMethodChange,
  settleNotes,
  onSettleNotesChange,
  settleError,
  isPending,
  onSubmit,
  onClose,
}) => {
  const balance = Number(courier.balance) || 0;

  return (
    <div className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-panel rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-line space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="font-black text-sm text-ink flex items-center gap-2">
            <Wallet className="w-5 h-5 text-ok" />
            <span>تصفية مستحقات: {courier.name}</span>
          </h3>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="إغلاق" className="p-2">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Current Balance Summary Box */}
        <div className="p-3 bg-surface-2/60 rounded-2xl border border-line text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted font-bold">صافي رصيد الدفاتر:</span>
            <Badge
              tone={balance > 0 ? 'ok' : balance < 0 ? 'bad' : 'neutral'}
              className="tabular-nums font-black text-sm px-2.5 py-0.5 rounded-lg"
            >
              {formatCurrency(courier.balance)}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs text-muted border-t border-line pt-1.5">
            <span>معلق لدى الشركة (COD):</span>
            <span className="tabular-nums font-bold text-info">
              {formatCurrency(courier.pending_cod_amount || 0)}
            </span>
          </div>
        </div>

        {/* Type Toggle: Receipt (توريد كاش) vs Payment (صرف أتعاب) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onSettleTypeChange('RECEIPT')}
            className={`min-h-[44px] py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              settleType === 'RECEIPT'
                ? 'bg-ok-soft border-ok text-ok shadow-2xs font-black'
                : 'border-line text-muted hover:bg-surface-2 hover:text-ink'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 text-ok" />
            <span>قبض وتوريد للخزينة</span>
          </button>

          <button
            type="button"
            onClick={() => onSettleTypeChange('PAYMENT')}
            className={`min-h-[44px] py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              settleType === 'PAYMENT'
                ? 'bg-bad-soft border-bad text-bad shadow-2xs font-black'
                : 'border-line text-muted hover:bg-surface-2 hover:text-ink'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-bad" />
            <span>صرف أتعاب للشركة</span>
          </button>
        </div>

        <p className="text-xs text-muted leading-relaxed bg-surface-2/60 p-2.5 rounded-xl border border-line">
          {settleType === 'RECEIPT'
            ? 'استلام صافي التحصيلات من شركة الشحن (COD مخصوماً منها أجور التوصيل) وإيداعها مباشرة بالخزينة/الحساب المالي.'
            : 'صرف نقدية لشركة الشحن من الخزينة/الحساب المالي لتغطية تكاليف الشحن والتوصيل.'}
        </p>

        <div className="space-y-3">
          <Input
            label="المبلغ المراد تسويته (ج.م) *"
            type="number"
            step="0.01"
            value={settleAmount}
            onChange={(e) => onSettleAmountChange(Number(e.target.value))}
            className="tabular-nums font-bold"
          />

          <Select
            label="طريقة الإيداع / الصرف:"
            value={settleMethod}
            onChange={(e) => onSettleMethodChange(e.target.value as SettleMethod)}
            options={METHOD_OPTIONS}
          />

          <Input
            label="ملاحظات أو رقم التحويل (اختياري):"
            type="text"
            placeholder="مثال: تصفية طرود الأسبوع / تحويل إنستاباي..."
            value={settleNotes}
            onChange={(e) => onSettleNotesChange(e.target.value)}
          />
        </div>

        {settleError && (
          <p className="text-xs text-bad bg-bad-soft p-2.5 rounded-xl border border-bad/30 font-bold">
            {settleError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            isLoading={isPending}
            disabled={isPending || settleAmount <= 0}
            onClick={onSubmit}
          >
            تأكيد التصفية والتوريد
          </Button>
        </div>
      </div>
    </div>
  );
};
