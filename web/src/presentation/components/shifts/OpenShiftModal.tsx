import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, X, AlertCircle, Coins, Clock } from 'lucide-react';
import { apiClient } from '../../../data/api/client';
import { Button, Textarea } from '../ui';

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OpenShiftModal: React.FC<OpenShiftModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [openingBalance, setOpeningBalance] = useState<number | string>(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const openShiftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/shifts/open', {
        opening_balance: Number(openingBalance) || 0,
        notes: notes || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-shift'] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['treasuries'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'تعذر بدء الوردية، يرجى المحاولة لاحقاً');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    openShiftMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-panel rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-line animate-in zoom-in-95 duration-200">
        <div className="p-6 bg-surface border-b border-line text-ink flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-ok-soft text-ok rounded-2xl border border-ok/20">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-black text-ink">بدء وردية جديدة (فتح الدرج / العهدة)</h3>
              <p className="text-xs text-muted mt-0.5">تسجيل بداية اليوم ومطابقة رصيد الافتتاح</p>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-bad-soft border border-bad/20 text-bad text-xs rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-bad flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-warn" />
              <span>الرصيد الافتتاحي</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[48px] text-lg font-black tabular-nums pl-14 pr-4 py-3 border border-line rounded-2xl text-ink focus:outline-none focus:ring-2 focus:ring-brand transition-all bg-surface-2"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">
                ج.م
              </span>
            </div>
            <p className="text-[11px] text-muted">
              المبلغ النقدي المتواجد في الدرج قبل بدء أي عملية بيع، اتركه 0 إذا لم يكن هناك فكة.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-muted" />
              <span>ملاحظات بدء الوردية (اختياري)</span>
            </label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات حول حالة الدرج أو السيارة أو خط السير..."
              className="rounded-2xl text-xs"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <Button
              type="submit"
              variant="primary"
              isLoading={openShiftMutation.isPending}
              className="flex-1 text-sm font-black"
            >
              {openShiftMutation.isPending ? 'جاري بدء الوردية...' : 'تأكيد فتح الوردية'}
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