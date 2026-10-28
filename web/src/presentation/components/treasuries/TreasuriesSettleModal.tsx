import React from 'react';
import { formatCurrency } from '@pos-mandob/shared';
import { ShieldCheck, X } from 'lucide-react';
import type { TreasuriesViewModel } from './types';

export const TreasuriesSettleModal: React.FC<{ vm: TreasuriesViewModel }> = ({ vm }) => {
  const { settlementNotes, setSettlementNotes, selectedShiftToSettle, setSelectedShiftToSettle, settleMutation } = vm;

  return (
    <>
      {/* Settle Confirmation Modal - Responsive Bottom Sheet */}
      {selectedShiftToSettle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5 sm:hidden" />
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">تأكيد استلام وتوريد النقدية</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    الوردية: {selectedShiftToSettle.shift_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedShiftToSettle(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-2">
                <div className="flex justify-between items-center text-emerald-900 font-bold">
                  <span>المبلغ المحصّل باليد:</span>
                  <span className="font-mono text-base font-black text-emerald-700">
                    {formatCurrency(selectedShiftToSettle.actual_cash)}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-700 leading-relaxed">
                  سيتم تحويل هذا المبلغ مباشرة من عهدة{' '}
                  <strong>{selectedShiftToSettle.user?.name}</strong> وإيداعه في خزينة الفرع / الخزينة الرئيسية،
                  وإغلاق دورة الوردية رسمياً.
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  ملاحظات الاستلام / إيصال التوريد (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  placeholder="تم استلام المبلغ نقداً ومطابقته بالخزينة..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  disabled={settleMutation.isPending}
                  onClick={() =>
                    settleMutation.mutate({
                      shiftId: selectedShiftToSettle.id,
                      notes: settlementNotes,
                    })
                  }
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl text-xs font-black shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {settleMutation.isPending ? 'جاري الاعتماد...' : 'تأكيد الاستلام والإيداع في الخزينة'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedShiftToSettle(null)}
                  className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
