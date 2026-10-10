import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, X, AlertCircle, Coins, Clock } from 'lucide-react';
import { apiClient } from '../../../data/api/client';

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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-black">بدء وردية جديدة (فتح الدرج / العهدة)</h3>
              <p className="text-xs text-slate-400 mt-0.5">تسجيل بداية اليوم ومطابقة رصيد الافتتاح</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-600" />
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
                className="w-full text-lg font-black font-mono pl-14 pr-4 py-3 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all bg-slate-50/50"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                ج.م
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              المبلغ النقدي المتواجد في الدرج قبل بدء أي عملية بيع، اتركه 0 إذا لم يكن هناك فكة.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>ملاحظات بدء الوردية (اختياري)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات حول حالة الدرج أو السيارة أو خط السير..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={openShiftMutation.isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl text-sm font-black shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {openShiftMutation.isPending ? 'جاري بدء الوردية...' : 'تأكيد فتح الوردية'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-bold transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};