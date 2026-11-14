import React from 'react';
import { formatCurrency } from '@pos-mandob/shared';
import { Send, X } from 'lucide-react';
import type { TreasuriesViewModel } from './types';
import { Button, Input, Select, Textarea } from '../ui';

export const TreasuriesTransferModal: React.FC<{ vm: TreasuriesViewModel }> = ({ vm }) => {
  const { transferModalOpen, setTransferModalOpen, transferData, setTransferData, transferDestinations, transferMutation, treasuries } = vm;

  return (
    <>
      {/* Transfer Modal - Responsive Bottom Sheet */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-panel rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-line animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-line rounded-full mx-auto my-2.5 sm:hidden" />
            <div className="p-6 bg-surface border-b border-line text-ink flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand-soft text-brand rounded-2xl border border-brand/20">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-ink">تحويل أموال بين الخزن والحسابات</h3>
                  <p className="text-xs text-muted mt-0.5">نقل رصيد بين الخزينة الرئيسية، البنوك، والأدراج</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-ink rounded-xl hover:bg-surface-2 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                transferMutation.mutate();
              }}
              className="p-6 space-y-4 overflow-y-auto"
            >
              <Select
                label="التحويل من خزينة / حساب:"
                required
                value={transferData.from_treasury_id}
                onChange={(e) =>
                  setTransferData({ ...transferData, from_treasury_id: e.target.value })
                }
                className="text-xs font-bold"
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
              </Select>

              <Select
                label="التحويل إلى خزينة / حساب:"
                required
                value={transferData.to_treasury_id}
                onChange={(e) =>
                  setTransferData({ ...transferData, to_treasury_id: e.target.value })
                }
                className="text-xs font-bold"
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
              </Select>

              <Input
                label="المبلغ المحول (ج.م):"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={transferData.amount}
                onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                placeholder="0.00"
                className="font-bold tabular-nums"
              />

              <Textarea
                label="ملاحظات التحويل:"
                rows={2}
                value={transferData.notes}
                onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                placeholder="سبب التحويل، رقم العملية، أو إيداع بنكي..."
                className="text-xs"
              />

              <div className="pt-2 flex items-center gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={transferMutation.isPending}
                  className="flex-1 text-xs font-black"
                >
                  {transferMutation.isPending ? 'جاري التحويل...' : 'تأكيد التحويل المالي'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setTransferModalOpen(false)}
                  className="text-xs font-bold"
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
