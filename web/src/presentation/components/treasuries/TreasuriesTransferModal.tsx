import React from 'react';
import { formatCurrency } from '@pos-mandob/shared';
import { Send, X } from 'lucide-react';
import type { TreasuriesViewModel } from './types';

export const TreasuriesTransferModal: React.FC<{ vm: TreasuriesViewModel }> = ({ vm }) => {
  const { transferModalOpen, setTransferModalOpen, transferData, setTransferData, transferDestinations, transferMutation, treasuries } = vm;

  return (
    <>
      {/* Transfer Modal - Responsive Bottom Sheet */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5 sm:hidden" />
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary-500/20 text-primary-400 rounded-2xl border border-primary-500/30">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">تحويل أموال بين الخزن والحسابات</h3>
                  <p className="text-xs text-slate-400 mt-0.5">نقل رصيد بين الخزينة الرئيسية، البنوك، والأدراج</p>
                </div>
              </div>
              <button
                onClick={() => setTransferModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                transferMutation.mutate();
              }}
              className="p-6 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">التحويل من خزينة / حساب:</label>
                <select
                  required
                  value={transferData.from_treasury_id}
                  onChange={(e) =>
                    setTransferData({ ...transferData, from_treasury_id: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">-- اختر الخزينة المحول منها --</option>
                  {treasuries.map((t: any) => {
                    const typeLabel =
                      t.type === 'MAIN'
                        ? '🏛️ الخزينة المركزية (الإدارة)'
                        : t.type === 'BRANCH_SAFE'
                        ? `🏢 فرع: ${t.branch_name || ''}`
                        : t.type === 'BANK'
                        ? '💳 حساب بنكي'
                        : t.type === 'WALLET'
                        ? '📱 محفظة إلكترونية'
                        : t.type === 'OWNER_DRAWINGS'
                        ? '👤 جاري المالك'
                        : '🏪 درج / عهدة';
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} [{typeLabel}] (الرصيد: {formatCurrency(t.current_balance)})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">التحويل إلى خزينة / حساب:</label>
                <select
                  required
                  value={transferData.to_treasury_id}
                  onChange={(e) =>
                    setTransferData({ ...transferData, to_treasury_id: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">-- اختر الخزينة المحول إليها --</option>
                  {transferDestinations
                    .filter((t: any) => t.id !== Number(transferData.from_treasury_id))
                    .map((t: any) => {
                      const typeLabel =
                        t.type === 'MAIN'
                          ? '🏛️ الخزينة المركزية (الإدارة)'
                          : t.type === 'BRANCH_SAFE'
                          ? `🏢 فرع: ${t.branch_name || ''}`
                          : t.type === 'BANK'
                          ? '💳 حساب بنكي'
                          : t.type === 'WALLET'
                          ? '📱 محفظة إلكترونية'
                          : t.type === 'OWNER_DRAWINGS'
                          ? '👤 جاري المالك'
                          : '🏪 درج / عهدة';
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name} [{typeLabel}] (الرصيد: {formatCurrency(t.current_balance)})
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">المبلغ المحول (ج.م):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={transferData.amount}
                  onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">ملاحظات التحويل:</label>
                <textarea
                  rows={2}
                  value={transferData.notes}
                  onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                  placeholder="سبب التحويل، رقم العملية، أو إيداع بنكي..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={transferMutation.isPending}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-2xl text-xs font-black shadow-sm transition-all disabled:opacity-50"
                >
                  {transferMutation.isPending ? 'جاري التحويل...' : 'تأكيد التحويل المالي'}
                </button>
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
