import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, X, AlertCircle, Coins, Calculator, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { apiClient } from '../../../data/api/client';
import { ShiftZReportModal, ShiftZReportData } from './ShiftZReportModal';
import { Badge, Button, Textarea } from '../ui';

interface ShiftData {
  id: number;
  shift_number: string;
  opening_balance: number;
  cash_sales: number;
  electronic_sales: number;
  credit_sales: number;
  cash_receipts: number;
  cash_returns: number;
  expenses: number;
  expected_cash: number;
}

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClosedSuccess?: (closedShift: ShiftZReportData) => void;
  shift: ShiftData;
}

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({
  isOpen,
  onClose,
  onClosedSuccess,
  shift,
}) => {
  const queryClient = useQueryClient();
  const [actualCash, setActualCash] = useState<number | string>(shift.expected_cash || 0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [closedShiftResult, setClosedShiftResult] = useState<ShiftZReportData | null>(null);

  const numActual = Number(actualCash) || 0;
  const diff = useMemo(() => {
    return Math.round((numActual - shift.expected_cash) * 100) / 100;
  }, [numActual, shift.expected_cash]);

  const closeShiftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/shifts/close', {
        actual_cash: numActual,
        notes: notes || undefined,
      });
      return res.data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['active-shift'] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['treasuries'] });
      if (res?.data) {
        if (onClosedSuccess) {
          onClosedSuccess(res.data);
        } else {
          setClosedShiftResult(res.data);
        }
      } else {
        onClose();
      }
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'تعذر تقفيل الوردية، يرجى المحاولة لاحقاً');
    },
  });

  if (!isOpen) return null;

  if (closedShiftResult) {
    return (
      <ShiftZReportModal
        isOpen={true}
        onClose={() => {
          setClosedShiftResult(null);
          onClose();
        }}
        shift={closedShiftResult}
      />
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    closeShiftMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-panel rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-line animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 bg-surface border-b border-line text-ink flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-bad-soft text-bad rounded-2xl border border-bad/20">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-ink">تقفيل الوردية وتسليم النقدية</h3>
                <Badge tone="neutral" className="tabular-nums font-bold">
                  {shift.shift_number}
                </Badge>
              </div>
              <p className="text-xs text-muted mt-0.5">جرد الدرج الفعلي وإعداد محضر تسليم العهدة</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-ink rounded-xl hover:bg-surface-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-bad-soft border border-bad/20 text-bad text-xs rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-bad flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ملخص الحركة النقدية في الوردية */}
          <div className="bg-surface-2 border border-line rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-black text-ink flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-muted" />
              <span>بيان النقدية المحسوبة بالنظام أثناء الوردية</span>
            </h4>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-panel p-2.5 rounded-xl border border-line flex justify-between items-center">
                <span className="text-muted">رصيد الافتتاح:</span>
                <span className="font-bold text-ink tabular-nums">{formatCurrency(shift.opening_balance)}</span>
              </div>
              <div className="bg-panel p-2.5 rounded-xl border border-line flex justify-between items-center">
                <span className="text-muted">مبيعات كاش:</span>
                <span className="font-bold text-ok tabular-nums">+{formatCurrency(shift.cash_sales)}</span>
              </div>
              <div className="bg-panel p-2.5 rounded-xl border border-line flex justify-between items-center">
                <span className="text-muted">تحصيلات عملاء:</span>
                <span className="font-bold text-ok tabular-nums">+{formatCurrency(shift.cash_receipts)}</span>
              </div>
              <div className="bg-panel p-2.5 rounded-xl border border-line flex justify-between items-center">
                <span className="text-muted">مصروفات ونثريات:</span>
                <span className="font-bold text-bad tabular-nums">-{formatCurrency(shift.expenses)}</span>
              </div>
            </div>

            <div className="bg-brand-soft border border-brand/20 p-3 rounded-xl flex items-center justify-between">
              <span className="text-xs font-black text-brand-ink">النقدية المتوقعة في الدرج (المحسوبة):</span>
              <span className="text-base font-black text-brand tabular-nums">
                {formatCurrency(shift.expected_cash)}
              </span>
            </div>
          </div>

          {/* إدخال الجرد الفعلي */}
          <div className="space-y-2">
            <label className="text-xs font-black text-ink flex items-center gap-1.5">
              <span>المبلغ الفعلي الموجود بالدرج / العهدة بعد العد باليد:</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="w-full min-h-[48px] text-xl font-black tabular-nums pl-14 pr-4 py-3 border-2 border-line focus:border-brand rounded-2xl text-ink focus:outline-none focus:ring-4 focus:ring-brand/15 transition-all bg-panel"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">
                ج.م
              </span>
            </div>
          </div>

          {/* مقارنة العجز والزيادة */}
          <div>
            {diff === 0 ? (
              <div className="p-3.5 bg-ok-soft border border-ok/20 text-ok rounded-2xl flex items-center gap-2.5 text-xs font-bold">
                <CheckCircle2 className="w-5 h-5 text-ok flex-shrink-0" />
                <span>الدرج مطابق تماماً للنظام ولا يوجد أي عجز أو زيادة (0.00 ج.م).</span>
              </div>
            ) : diff > 0 ? (
              <div className="p-3.5 bg-warn-soft border border-warn/20 text-warn rounded-2xl flex items-center gap-2.5 text-xs font-bold">
                <AlertTriangle className="w-5 h-5 text-warn flex-shrink-0" />
                <div>
                  <div className="tabular-nums">يوجد فائض / زيادة في الدرج بمقدار: +{formatCurrency(diff)}</div>
                  <div className="text-[11px] font-normal text-warn mt-0.5">
                    سيتم قيد الزيادة في تقرير التقفيل لإخطار الإدارة.
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-bad-soft border border-bad/20 text-bad rounded-2xl flex items-center gap-2.5 text-xs font-bold">
                <AlertTriangle className="w-5 h-5 text-bad flex-shrink-0" />
                <div>
                  <div className="tabular-nums">يوجد عجز في الدرج بمقدار: {formatCurrency(diff)}</div>
                  <div className="text-[11px] font-normal text-bad mt-0.5">
                    يرجى توضيح سبب العجز في الملاحظات أدناه قبل التسليم.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ملاحظات التقفيل */}
          <Textarea
            label="ملاحظات التقفيل والتسليم"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أي تفاصيل أو أسباب للعجز/الزيادة إن وجدت..."
            className="rounded-2xl text-xs"
          />

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <Button
              type="submit"
              variant="primary"
              isLoading={closeShiftMutation.isPending}
              className="flex-1 text-sm font-black"
            >
              {closeShiftMutation.isPending ? 'جاري تقفيل الوردية...' : 'تأكيد تقفيل الوردية وتسليم العهدة'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="text-xs font-bold"
            >
              إلغاء
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};