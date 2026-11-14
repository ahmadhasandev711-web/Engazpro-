import React from 'react';
import { formatCurrency } from '@pos-mandob/shared';
import { ShieldCheck, X } from 'lucide-react';
import type { TreasuriesViewModel } from './types';
import { Button, Textarea } from '../ui';

export const TreasuriesSettleModal: React.FC<{ vm: TreasuriesViewModel }> = ({ vm }) => {
  const { settlementNotes, setSettlementNotes, selectedShiftToSettle, setSelectedShiftToSettle, settleMutation } = vm;

  return (
    <>
      {/* Settle Confirmation Modal - Responsive Bottom Sheet */}
      {selectedShiftToSettle && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-panel rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-line animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-line rounded-full mx-auto my-2.5 sm:hidden" />
            <div className="p-6 bg-surface border-b border-line text-ink flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-ok-soft text-ok rounded-2xl border border-ok/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-ink">تأكيد استلام وتوريد النقدية</h3>
                  <p className="text-xs text-muted tabular-nums mt-0.5">
                    الوردية: {selectedShiftToSettle.shift_number}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShiftToSettle(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-ink rounded-xl hover:bg-surface-2 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="p-4 bg-ok-soft border border-ok/20 rounded-2xl text-xs space-y-2">
                <div className="flex justify-between items-center text-ink font-bold">
                  <span>المبلغ المحصّل باليد:</span>
                  <span className="tabular-nums text-base font-black text-ok">
                    {formatCurrency(selectedShiftToSettle.actual_cash)}
                  </span>
                </div>
                <div className="text-[11px] text-ok leading-relaxed">
                  سيتم تحويل هذا المبلغ مباشرة من عهدة{' '}
                  <strong>{selectedShiftToSettle.user?.name}</strong> وإيداعه في خزينة الفرع / الخزينة الرئيسية،
                  وإغلاق دورة الوردية رسمياً.
                </div>
              </div>

              <Textarea
                label="ملاحظات الاستلام / إيصال التوريد (اختياري)"
                rows={2}
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                placeholder="تم استلام المبلغ نقداً ومطابقته بالخزينة..."
                className="text-xs"
              />

              <div className="pt-2 flex items-center gap-3">
                <Button
                  type="button"
                  variant="primary"
                  isLoading={settleMutation.isPending}
                  onClick={() =>
                    settleMutation.mutate({
                      shiftId: selectedShiftToSettle.id,
                      notes: settlementNotes,
                    })
                  }
                  className="flex-1 text-xs font-black"
                >
                  {settleMutation.isPending ? 'جاري الاعتماد...' : 'تأكيد الاستلام والإيداع في الخزينة'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelectedShiftToSettle(null)}
                  className="text-xs font-bold"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
