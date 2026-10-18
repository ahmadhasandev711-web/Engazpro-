import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, X, AlertCircle, Coins, Calculator, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { apiClient } from '../../../data/api/client';
import { ShiftZReportModal, ShiftZReportData } from './ShiftZReportModal';

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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black">تقفيل الوردية وتسليم النقدية</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white/20 text-white">
                  {shift.shift_number}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">جرد الدرج الفعلي وإعداد محضر تسليم العهدة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ملخص الحركة النقدية في الوردية */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-slate-500" />
              <span>بيان النقدية المحسوبة بالنظام أثناء الوردية</span>
            </h4>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex justify-between items-center">
                <span className="text-slate-500">رصيد الافتتاح:</span>
                <span className="font-bold text-slate-800 font-mono">{formatCurrency(shift.opening_balance)}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex justify-between items-center">
                <span className="text-slate-500">مبيعات كاش:</span>
                <span className="font-bold text-emerald-600 font-mono">+{formatCurrency(shift.cash_sales)}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex justify-between items-center">
                <span className="text-slate-500">تحصيلات عملاء:</span>
                <span className="font-bold text-emerald-600 font-mono">+{formatCurrency(shift.cash_receipts)}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex justify-between items-center">
                <span className="text-slate-500">مصروفات ونثريات:</span>
                <span className="font-bold text-rose-600 font-mono">-{formatCurrency(shift.expenses)}</span>
              </div>
            </div>

            <div className="bg-primary-50/70 border border-primary-200/60 p-3 rounded-xl flex items-center justify-between">
              <span className="text-xs font-black text-primary-900">النقدية المتوقعة في الدرج (المحسوبة):</span>
              <span className="text-base font-black text-primary-700 font-mono">
                {formatCurrency(shift.expected_cash)}
              </span>
            </div>
          </div>

          {/* إدخال الجرد الفعلي */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
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
                className="w-full text-xl font-black font-mono pl-14 pr-4 py-3 border-2 border-slate-300 focus:border-primary-500 rounded-2xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary-100 transition-all bg-white"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                ج.م
              </span>
            </div>
          </div>

          {/* مقارنة العجز والزيادة */}
          <div>
            {diff === 0 ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2.5 text-xs font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>الدرج مطابق تماماً للنظام ولا يوجد أي عجز أو زيادة (0.00 ج.م).</span>
              </div>
            ) : diff > 0 ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex items-center gap-2.5 text-xs font-bold">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <div>يوجد فائض / زيادة في الدرج بمقدار: +{formatCurrency(diff)}</div>
                  <div className="text-[11px] font-normal text-amber-700 mt-0.5">
                    سيتم قيد الزيادة في تقرير التقفيل لإخطار الإدارة.
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-2.5 text-xs font-bold">
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <div>
                  <div>يوجد عجز في الدرج بمقدار: {formatCurrency(diff)}</div>
                  <div className="text-[11px] font-normal text-rose-700 mt-0.5">
                    يرجى توضيح سبب العجز في الملاحظات أدناه قبل التسليم.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ملاحظات التقفيل */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">ملاحظات التقفيل والتسليم</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل أو أسباب للعجز/الزيادة إن وجدت..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={closeShiftMutation.isPending}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-2xl text-sm font-black shadow-lg shadow-slate-900/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {closeShiftMutation.isPending ? 'جاري تقفيل الوردية...' : 'تأكيد تقفيل الوردية وتسليم العهدة'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-bold transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};