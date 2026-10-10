import React, { useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';
import { User } from '@pos-mandob/shared';

interface ExtendSubscriptionModalProps {
  user: User;
  onClose: () => void;
  onExtend: (payload: { userId: number; days: number; notes: string }) => void;
  isPending: boolean;
}

export const ExtendSubscriptionModal: React.FC<ExtendSubscriptionModalProps> = ({
  user,
  onClose,
  onExtend,
  isPending,
}) => {
  const [extendDays, setExtendDays] = useState<number>(365);
  const [extendNotes, setExtendNotes] = useState<string>('تمديد استثنائي من الإدارة العامة');

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">تمديد اشتراك مباشر</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              المستخدم: <strong>{user.name}</strong> ({user.phone})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">اختر مدة التمديد الإضافية</label>
            <select
              value={extendDays}
              onChange={(e) => setExtendDays(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value={365}>سنة كاملة (+365 يوم)</option>
              <option value={30}>شهر واحد (+30 يوم)</option>
              <option value={90}>3 شهور (+90 يوم)</option>
              <option value={180}>6 شهور (+180 يوم)</option>
              <option value={730}>سنتين (+730 يوم)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">ملاحظة التمديد الإداري</label>
            <input
              type="text"
              value={extendNotes}
              onChange={(e) => setExtendNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="سبب التمديد..."
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={() =>
              onExtend({
                userId: user.id,
                days: extendDays,
                notes: extendNotes,
              })
            }
            disabled={isPending}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl transition-colors shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>تأكيد التمديد الفوري</span>
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};
